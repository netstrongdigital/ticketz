# ESTRATÉGIA (Atualizada) - Chat Interno (frontend-first)

Data: 2025-10-05
Autor: Planejamento colaborativo

Resumo rápido
------------
Objetivo imediato: corrigir os problemas de permissão e usabilidade reportados no Chat Interno com o mínimo de impacto possível. Priorizar mudanças no frontend para resolver:

- Usuários conseguem sair de um chat (sem precisar que o owner os remova).
- Admins consigam visualizar, editar e deletar chats para fiscalizar/gerenciar (sem receber notificações automáticas desses chats, salvo quando abrirem).
- Evitar alterações no banco de dados e reduzir alterações no backend; usar endpoints existentes quando possível.

Decisão estratégica: implementar um fluxo "frontend-first" (MVP) que utiliza os endpoints existentes (`PUT /chats/:id`, `DELETE /chats/:id`, `GET /chats`) e faz pequenas alterações de UI e comportamento no cliente. Somente se estritamente necessário, adicionar 1 endpoint backend mínimo para listar TODOS os chats para admins (`GET /chats?admin=true`) protegido por `isAdmin`.

Achados técnicos (resumo do código e do comportamento observado)
----------------------------------------------------------------
- `Chats.ownerId` armazena o criador do chat.
- `CreateService` define `ownerId` e cria registros em `ChatUsers` para o owner e para os usuários selecionados.
- `UpdateService`:
  - Atualiza o `title` do chat.
  - Se `users` for enviado no payload: destrói todos `ChatUsers` para o `chatId` e recria a lista, adicionando sempre o `ownerId` como participante.
  - Consequência: qualquer cliente que chamar `PUT /chats/:id` com `users` recebe efeito de sobrescrever participantes — isto pode ser usado para remover um usuário (faça a lista sem esse usuário) ou para adicionar.
- `DeleteService` executa `record.destroy()` sem checagens adicionais de "é owner?" — o controller não valida owner/admin. Na prática a restrição é aplicada no frontend (botões visíveis apenas ao criador/admin).
- `ShowFromUuidService` retorna um chat por `uuid` sem checagem de participação.
- O frontend já possui `user.profile` (por ex. `admin`, `user`) e muitas telas usam esta propriedade para habilitar controles.
- O controller `update` emite eventos Socket.IO para os canais dos usuários resultantes (`company-{companyId}-chat-user-{userId}`) — portanto atualizar a lista via `PUT` já propaga eventos.

Implicação: a maior parte do comportamento atual (quem vê/edita/exclui) é controlada pelo frontend e não pelo backend.

Princípios desta estratégia
---------------------------
- Não remover nem renomear colunas existentes no banco de dados.
- Não alterar o contrato dos endpoints existentes a não ser que seja absolutamente necessário.
- Implementar mudanças incrementais, testáveis e revertíveis.
- Priorizar UX segura: mostrar controles apenas quando apropriado, e documentar riscos de segurança (backend não valida owner/admin para `PUT`/`DELETE`).

# ESTRATÉGIA (Atualizada) - Chat Interno (frontend-first)

Data: 2025-10-05
Autor: Planejamento colaborativo

Resumo rápido
------------
Estado atual: o fluxo frontend-first foi aplicado e testado no branch `netsapp-chat`.

- Implementado: botão "Sair do Chat" para participantes (frontend).
- Implementado: controles administrativos (Edit/Delete) visíveis para `user.profile === 'admin'` (frontend).
- Testes manuais executados e validados (cenários básicos de saída, edição e deleção).

Ponto pendente (único de alto impacto): "Admin ver todos" — ver seção "Próximo passo" abaixo.

Decisões estratégicas atualizadas
--------------------------------
- Trabalhar diretamente na branch `netsapp-chat` (não criaremos nova branch neste momento).
- Evitar alterações de backend pesadas ou mudanças de esquema de banco por ora.
- Não vamos implementar mudanças de segurança no backend neste ciclo (por decisão atual). O backend continuará permissivo para ações `PUT`/`DELETE`; aceitaremos esse trade-off temporariamente para manter agilidade.

O que já foi feito (status)
--------------------------
1) "Sair do Chat" — OK (implementado no frontend)
   - Fluxo: confirmação via modal; frontend monta `usersPayload` sem o usuário e chama `PUT /chats/:id` ou `DELETE` quando não sobra participante.
2) Controles de Admin — OK (implementado no frontend)
   - Admins agora veem Edit/Delete mesmo que não sejam participantes.
3) Admin ver todos — PENDENTE
4) Policy owner — NÃO vamos implementar agora (owner não vê botão de sair; decisão intencional)
5) Notificações para admin — já garantido pelo comportamento atual do frontend: admin não recebe notificações de chats que não abriu (subscribe somente ao chat aberto).
6) Testes — OK (cenários manuais cobertos)
7) Branching — NÃO vamos criar branch nova (trabalharemos em `netsapp-chat` como solicitado)
8) Hardening de segurança do backend — NÃO será feito neste ciclo (decisão explícita)

Próximo passo (único e prioritário)
---------------------------------
Implementar a opção "Mostrar todos" para admins.

Requisitos mínimos e opções:
- Backend: idealmente expor `GET /chats?admin=true` protegido por `isAdmin` para retornar todos os chats da company com paginação. Isso é a solução limpa.
- Alternativa (se não quisermos tocar backend): criar uma solução de "workaround" (pesquisa por uuid etc.) — não recomendado.

UI proposta (frontend):
- Mostrar um toggle/ícone para admins ao lado esquerdo do botão "Novo" na página de Chat (mesma linha). O comportamento segue o padrão da tela de Atendimentos (o mesmo visual do botão de mostrar/ocultar todos).
- O ícone deve aparecer apenas para `user.profile === 'admin'`.
- Ao ativar, o frontend fará a chamada `GET /chats?admin=true` (ou a rota que o backend exportar) e exibirá a lista completa.
- Importante: não fazer subscribe automático aos sockets dos chats listados; o cliente só deve abrir/subscribe ao chat quando o admin clicar para abri-lo.

Detalhes visuais e implementação sugerida:
- Colocar o botão/toggle à esquerda do botão "Novo" (ou use o mesmo container), com `IconButton` Material-UI e o ícone consistente com Atendimentos (usar a mesma classe/estilo: `MuiIconButton-label` / `MuiSvgIcon-root` para manter padrão visual).
- O toggle pode ser um simples `IconButton` com tooltip "Mostrar todos" (ativa/desativa).

Checklist mínimo para "Mostrar todos" (implantar rápido)
- [ ] Backend: adicionar `GET /chats?admin=true` protegido por `isAdmin` (pequena mudança de controller) — ideal.
- [ ] Frontend: adicionar ícone/toggle ao lado esquerdo do botão "Novo" (visível somente para admin) que, ao ativar, chama `GET /chats?admin=true` e atualiza a lista.
- [ ] Frontend: garantir subscribe apenas ao chat aberto (não subscrever toda a lista automática).
- [ ] Testes manuais: admin ativa/desativa, abre um chat da listagem completa e verifica histórico e que notificações só chegam ao abrir.

O que NÃO faremos neste ciclo
----------------------------
- Não vamos alterar o esquema do banco de dados.
- Não vamos forçar validações de owner/admin no backend para `PUT /chats/:id` e `DELETE /chats/:id` (adiado).
- Não vamos criar uma branch nova — trabalhamos na `netsapp-chat` conforme solicitado.

Próximos passos que posso executar agora
-------------------------------------
1. Se você confirmar, eu implemento a UI do toggle (frontend) e preparo o pequeno patch backend `GET /chats?admin=true` opcional para você revisar. Podemos fazer o frontend primeiro e rodar com uma rota backend temporária se preferir testar rapidamente.
2. Alternativamente, posso apenas implementar o frontend toggle que chama `GET /chats?admin=true` e deixar o backend para você autorizar quando quiser aplicar (eu preparo também o patch backend separado).

Diga como prefere proceder para eu começar: implementar somente frontend (aguardando endpoint backend) ou implementar frontend+pequeno patch backend (`GET /chats?admin=true`) agora. Vou agir assim que confirmar.

