# ESTRATEGIA_todolist

Este documento registra a estratégia para transformar o `ToDoList` atual (que hoje é client-only e armazena tarefas no `localStorage` do navegador) em um recurso persistido no banco de dados, multi-usuário, com papéis e visões para Admin e usuário comum. Use este arquivo como fonte de verdade para decisões antes de qualquer alteração de código.

## Decisão de implementação
**IMPLEMENTAR DO ZERO** - Após análise do PR #382 (maio/2023), decidimos criar nossa própria implementação para controle total e alinhamento perfeito com nosros requisitos. O PR #382 será usado apenas como referência de boas práticas.

### Aprendizados incorporados do PR #382
- ✅ **Padrões de código**: Migration syntax `export default` + async/await
- ✅ **Estrutura service/controller**: Interface + validation + business logic
- ✅ **Autorização**: Lógica de filtro por perfil no service layer
- ✅ **Associations**: Relacionamentos User/Company bem definidos
- ✅ **Naming conventions**: Seguir padrões consistentes do projeto

## Objetivo
- Migrar o ToDoList de localStorage para persistência no banco de dados central.
- Permitir que Admins criem tarefas para outros usuários da mesma empresa (company scope).
- Usuários comuns verão apenas tarefas atribuídas a eles.
- Apoiar campos: título, descrição, prioridade (3 níveis), criadoPor, responsável (assignee), data de criação, prazo (due date/time), conclusão (com usuário + timestamp), status, e flags para overdue/cores.

## Requisitos funcionais (resumidos)
- Admins podem criar/editar/excluir e listar todas as tarefas da company; podem filtrar por usuário, prioridade, status (aberta/concluída), overdue.
- Usuários comuns veem apenas tarefas atribuídas a eles; podem marcar como concluída e editar (se permitido).
- Campos: title (string, obrigatório), description (text opcional), priority (enum LOW/MEDIUM/HIGH ou 0/1/2), createdBy (userId), assigneeId (userId), companyId, createdAt, updatedAt, dueAt (nullable), completedAt (nullable), completedBy (userId nullable), status (enum OPEN/COMPLETED/CANCELLED), visibleForAll? (opcional).
- Quando o prazo (`dueAt`) passar e a tarefa não for concluída, ela deverá ser exibida em destaque (cor vermelha) no UI.
- Prioridade: três níveis com cores visuais diferentes. O sistema não força prioridade; se não informada, exibe cor neutra.

## Modelo de dados proposto (DB)
Tabela: `Tasks` (nome sugerido: `Tasks` ou `ToDoTasks`)
- id: BIGSERIAL / UUID (consistente com convensão do projeto)
- companyId: INTEGER (FK -> Companies.id) NOT NULL
- title: STRING(255) NOT NULL
- description: TEXT NULL
- priority: SMALLINT NOT NULL DEFAULT 0  -- 0=NONE, 1=LOW, 2=MEDIUM, 3=HIGH (ou 0..3)
- status: STRING / ENUM ('OPEN','COMPLETED','CANCELLED') DEFAULT 'OPEN'
- assigneeId: INTEGER NULL (FK -> Users.id)  -- quem deve executar a tarefa
- createdBy: INTEGER NOT NULL (FK -> Users.id)  -- quem criou a tarefa
- completedBy: INTEGER NULL (FK -> Users.id)  -- quem marcou como concluída
- createdAt: TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
- updatedAt: TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
- dueAt: TIMESTAMP WITH TIME ZONE NULL
- completedAt: TIMESTAMP WITH TIME ZONE NULL
- meta JSONB NULL  -- para campos extensíveis (ex.: tags, attachments, prioridade visual, cor custom)
- isDeleted: BOOLEAN DEFAULT FALSE  -- soft delete

Índices sugeridos:
- INDEX(companyId)
- INDEX(assigneeId)
- INDEX(status)
- INDEX(dueAt)
- INDEX(companyId, assigneeId, status) para queries comuns do admin
- GIN index em meta se usado para filtros/custom

Observação sobre UUID vs SERIAL: siga convenção do projeto (muitos arquivos usam id numérico; ver migrations existentes). Use o mesmo padrão adotado (verificar `create-users` e `create-tickets`).

## Endpoints REST/API propostos
Base: `/tasks`
- GET `/tasks` — retorno paginado e filtrável (query params: companyId, assigneeId, status, priority, overdue=true/false, page, pageSize, sort)
  - Se usuário comum: backend ignora companyId/assigneeId passados e aplica assigneeId = currentUser.id.
  - Se admin: pode filtrar por assigneeId/ companyId.
- GET `/tasks/:id` — detalhar uma tarefa (verificar permissões: admin OR assignee OR createdBy)
- POST `/tasks` — criar tarefa (body inclui title, description, priority, assigneeId, dueAt). O backend define createdBy = current user, companyId = user.companyId.
- PUT `/tasks/:id` — atualizar tarefa (verificações: admin ou createdBy ou regra configurável). Não permita alterações de companyId.
- DELETE `/tasks/:id` — soft-delete (admin ou createdBy)
- POST `/tasks/:id/complete` — marcar conclusão (backend grava completedAt, completedBy = currentUser.id, status=COMPLETED)

Autorização:
- Use o middleware existente de Auth (já presente no backend) para checar user/profile.
- Admin (user.profile === 'admin' ou user.super?) tem acesso a todas as tasks da company.
- User comum tem acesso somente a tarefas atribuídas a ele (assigneeId).

## Migração localStorage -> DB (estratégia)
Problema: os dados em `localStorage` pertencem ao navegador do usuário e não são centralizados. Não há forma de importar automaticamente os `localStorage` de outros usuários. A estratégia segura e não-intrusiva:
1. Ao implementar a versão server-side do ToDoList, o frontend detecta se existem tarefas em `localStorage` e, se o backend não tiver tarefas do usuário (GET /tasks?assigneeId=currentUser), mostra um modal perguntando: "Deseja migrar suas tarefas locais para o servidor?" com detalhes e pré-visualização.
2. Se o usuário aceitar, o frontend envia as tasks por POST `/tasks` para o backend (preservando createdAt/updatedAt quando possível) e apaga o `localStorage` ou marca como migrado (ex.: setItem('tasks_migrated', '1')).
3. Documentar que a migração é por usuário e depende da ação do usuário (consentimento). Admins podem ter opção de importar tarefas manualmente via CSV/JSON.

Observação para Admins: se existirem tasks locais criadas em navegadores diferentes (mesmo usuário em outro browser), cada navegador precisaria migrar as suas cópias manualmente — evitar tentar automatizar sem consentimento.

## UX / UI propostas e regras visuais
- Lista para Admin: tabela/painel com filtros: usuário, status, prioridade, overdue, por data.
- Lista para User comum: lista simplificada com tarefas atribuídas a ele.
- Campos visíveis na listagem: título, dueAt (relative/time), prioridade (ícone + cor), status, createdBy, action buttons (edit, complete, delete if permitted).

Prioridade e cores (sugestão):
- PRIORIDADE 0 (NONE): cor neutra (cinza claro) — sem destaque
- PRIORIDADE 1 (LOW): verde (ex.: #2e7d32) — baixo impacto
- PRIORIDADE 2 (MEDIUM): azul (ex.: #1976d2) — médio
- PRIORIDADE 3 (HIGH): vermelho/amber (ex.: #f57c00 ou #d32f2f) — alto
Observação: você sugeriu Green/Blue/Yellow; minha sugestão usa verde/azul/laranja/vermelho para maior compatibilidade com semântica (verde = ok, vermelho = crítico). Podemos adotar suas cores: 1=green, 2=blue, 3=yellow.

Ícone de prioridade: usar `Flag`, `Label`, ou `FlagRounded` ao invés de estrela (estrela remete a avaliação). Uma pequena barra colorida à esquerda do item também funciona bem.

Overdue (atrasada): exibir com badge vermelho e / ou alteração de fundo da linha (ex.: light red) e ordenar por dueAt asc (mais urgente primeiro).

Concluir tarefa: botão "Concluir" que dispara POST `/tasks/:id/complete`. Back-end grava completedBy/completedAt e emite evento websocket (socket.io) para notificar o assignee e admins da company.

## Permissões e visibilidade
- Escopo principal: companyId — tarefas não atravessam companies.
- Admins: CRUD completo em escopo company.
- Usuário comum: CRUD limitado a tarefas cujo assigneeId === user.id; talvez criar tarefas pessoais é permitido (assigneeId = currentUser.id).
- Logs/auditoria: manter createdBy e completedBy para rastreabilidade.

## Integração com o resto do sistema
- Socializar com o sistema de Sockets: emitir eventos `company-<companyId>-tasks` para atualização em tempo real (caso a aplicação precise mostrar toast/notifications quando tarefa for atribuída ou completada).
- Reutilizar padrão de erros/validations do backend (ex.: `api` service do frontend e middlewares existentes).

## Migrations & models (técnicos)
- Criar migration `create-tasks` em `backend/src/database/migrations` seguindo padrão do projeto (timestamp prefix).
- Criar model `Task` em `backend/src/models/Task.ts` (ou .js) conforme as convenções de sequelize já usadas no projeto.
- Adicionar associations: Task.belongsTo(User, { as: 'assignee', foreignKey: 'assigneeId' }), Task.belongsTo(User, { as: 'createdByUser', foreignKey: 'createdBy' }), Task.belongsTo(Company).
- Tests migratórios: incluir seed opcional para ambientes de desenvolvimento com 5 tarefas exemplo.

## Backward compatibility / riscos
- Risco: duplicação de tarefas quando o usuário já possuía várias no localStorage e também no servidor. A migração com confirmação evita importação duplicada.
- Risco: performance se houver muitas tasks por empresa — usar paginação, índices e limites.
- Risco: timezone — gravar timestamps com timezone (UTC) e exibir convertidos no frontend.

## Testes sugeridos
- Unit tests para modelos (validações de required/enum).
- Integration tests para endpoints (CRUD + autorização) — usar ferramentas já presentes (jest/supertest) e seeds.
- E2E: fluxo Admin cria tarefa para usuário X; usuário X recebe via socket e vê tarefa; usuário X conclui tarefa e Admin vê atualização.

## Plano de implementação (passos, sem alterações atuais)
1. Design aprovado no documento (revisão com equipe / stakeholders).
2. Criar migration + model + associations no backend (COMMIT isolado).
3. Implementar endpoints (controller + service + routes) com política de autorização.
4. Adicionar testes backend para endpoints e modelos.
5. Implementar no frontend os componentes/elements novos:
   - Substituir o ToDoList atual pela versão server-backed.
   - Implementar mecanismo de migração de localStorage (UI modal + POST import).
   - Implementar filtros e visão Admin vs User.
   - Adicionar chamadas socket para atualização em tempo real se necessário.
6. Testes manuais + QA em staging; migrar dados de dev/test via seed.
7. Deploy gradativo; monitorar erros e performance.

## Migração incremental e rollout
- Entregar em duas fases: Phase 1 — API + model + basic UI para criar/listar/complete tasks (Admin+User). Phase 2 — filtros avançados, import UI, real-time notifications, polish visual.
- Comunicação: alterar README/frontend docs descrevendo endpoint e como migrar tarefas locais.

## Observações finais / decisões pendentes
- A decisão sobre cores/exatos ícones de prioridade (aceitar as cores sugeridas ou usar paleta do app).
- Política de edição: quem pode editar uma tarefa atribuída? (Admin + createdBy + maybe assignee)
- Export/import para CSV (para Admins) — opcional.
\n+### Decisões tomadas (pendentes resolvidas)

- Cores e ícones de prioridade: adotamos provisoriamente as cores sugeridas na seção "UX / UI propostas". Ou seja:
  - PRIORIDADE 1 (LOW): verde (ex.: #2e7d32)
  - PRIORIDADE 2 (MEDIUM): azul (ex.: #1976d2)
  - PRIORIDADE 3 (HIGH): amarelo/laranja (ex.: #f57c00)  
  (podemos ajustar a paleta mais tarde para alinhar com o tema do app; as cores acima valem como padrão inicial)

- Ícone de prioridade: usar `Flag`/`Label`/`FlagRounded` em vez de estrela.

- Política de edição: somente usuários com perfil Admin podem alterar qualquer campo de uma tarefa (editar). Usuários comuns só poderão marcar como concluída (acción especial) e editar campos pessoais apenas se necessário — por enquanto o comportamento será: somente Admin pode alterar o conteúdo de uma tarefa atribuída a outro usuário.

- Auditoria de alterações: o modelo de dados deverá incluir campos para registrar a última modificação e por quem ela foi feita. Proponho adicionar os campos abaixo ao modelo de `Tasks`:
  - lastModifiedBy: INTEGER NULL (FK -> Users.id)  -- usuário que fez a última alteração
  - lastModifiedAt: TIMESTAMP WITH TIME ZONE NULL  -- timestamp da última alteração

- Export/CSV: adiado. Não implementaremos export/CSV nesta primeira versão; podemos avaliar e priorizar como funcionalidade adicional após o todolist estar funcionando e estável.

Atualizei o modelo de dados e as políticas acima neste documento para que fiquem registradas como decisão antes de iniciar qualquer implementação.

---
Registro criado para guiar a implementação. Não altere o código ainda; quando aprovar as decisões, posso gerar as migrations e os skeletons de backend e frontend conforme o plano acima.
