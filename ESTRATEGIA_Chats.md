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

Plano de ação (MVP frontend-first)
----------------------------------
Objetivo do MVP: permitir que qualquer participante saia do chat, e que admins possam visualizar/editar/deletar chats (UI), sem mudança inicial no DB.

1) Implementar "Sair do Chat" (frontend only)
- Local: `frontend/src/pages/Chat/ChatMessages.js` (toolbar/menu do chat) e possivelmente no modal de edição.
- UI: botão "Sair do Chat" visível para participantes (quando `user.id` está em `currentChat.users`). Se o usuário for o `owner`, mostrar mensagem explicativa (owner não pode sair — ver item 4).
- Fluxo:
  1. O usuário confirma a ação em um diálogo.
  2. Frontend constrói `usersPayload` a partir de `currentChat.users`, removendo o usuário atual. O formato já usado pelo frontend ao salvar edição é: `[ { id, name }, ... ]` (veja tráfego de rede observado).
  3. Chamar `PUT /chats/:id` com `{ users: usersPayload, title: currentChat.title }`.
  4. Em caso de sucesso: remover o chat da lista local (`setChats`) e redirecionar o usuário para `/chats`. Mostrar toast de confirmação.
  5. O backend emitirá eventos via socket para os usuários restantes, mantendo a sincronização de UI.
- Limitação: se user é `owner`: `UpdateService` re-incluirá o owner automaticamente; portanto bloqueamos a ação no cliente e oferecemos mensagem explicativa (owner não pode sair). Se depois decidir que owner pode sair, precisaremos de pequena mudança backend (permitir `ownerId` ser alterado e não re-adicionar automaticamente).

2) Habilitar controles administrativos (frontend only)
- Local: `frontend/src/pages/Chat/ChatList.js`, `ChatMessages.js`, modal de edição.
- Regra UI: se `user.profile === 'admin'`, mostrar botões de Edit e Delete para cada chat (mesmo que o admin não esteja listado em `ChatUsers`). Já que o backend aceita `PUT` e `DELETE`, isso permite que o admin exerça essas ações hoje.
- Observação de segurança: habilitar botões no frontend melhora UX, mas o backend continuará permitindo a ação para quem souber o endpoint — para reforçar segurança no futuro, adicionar validações no backend com `isAdmin` ou checagem de owner.

3) Admin: "Ver todos" (opcional mínima mudança backend)
- Problema: `GET /chats` retorna apenas chats do usuário (ListService). Para admins visualizar *todos* os chats da empresa sem workarounds:
  - Opção recomendada (pequena mudança backend): implementar `GET /chats?admin=true` protegido por middleware `isAdmin` que retorne todos chats da `companyId` com paginação.
  - Alternativa sem backend: forçar a pesquisa por uuid manual (muito ruim). Recomendo a pequena rota backend se desejar a listagem completa.
- UI: por padrão admins não veem chats onde não sejam participantes. Adicionar um toggle "Mostrar todos (admin)" que, quando ativo, usa `GET /chats?admin=true`. Não fazer subscribe automático aos sockets desses chats; apenas subscribe ao chat aberto.

4) Policy sobre owner e transferência
- Proposta inicial (mínimo impacto): owner NÃO pode se auto-remover via fluxo "Sair". Owner só pode transferir propriedade ou o admin pode deletar/transferir. Transfer owner exige pequena alteração backend (permitir atualizar `ownerId`) — deixar para etapa seguinte, caso queira.

5) Notificações/subscribe
- O frontend já subscribe via socket ao `company-{companyId}-chat-{chatId}` para o chat atual e `company-{companyId}-chat-user-{userId}` para receber notificações.
- Para que admin não receba notificações automáticas de chats que não monitora, garantir que o cliente só subscribe ao canal do chat quando o admin abre o chat. Assim o admin só recebe notificações ao abrir/monitorar.

6) Testes manuais (cenários importantes)
- Cenário A: usuário comum cria chat (owner), adiciona B e C. B clica "Sair". Verificar: B não vê mais o chat; A e C recebem atualização; B não recebe novas mensagens.
- Cenário B: owner tenta sair. Verificar: UI bloqueia e explica que owner não pode sair (até transferir). Owner pode deletar o chat se desejar.
- Cenário C: admin vê e edita/deleta chat que não contém o admin. Verificar: admin consegue editar (chamada PUT funciona) e DELETE funciona; verificar se eventos socket atualizam os participantes.
- Cenário D: admin ativa "Mostrar todos" (se implementado) — ver lista completa, abrir chat para visualizar histórico; admin não recebe notificações a menos que abra o chat.

7) Rollout e feature flag
- Desenvolver em branch: `feature/chat-leave-admin-controls`.
- Envolver flag simples no frontend (const FEATURE_CHAT_LEAVE_ADMIN_CONTROLS = true/false) para ativar/desativar a UI em caso de rollback.
- Testar em staging com usuários reais.

8) Segurança e melhoria futura
- Importante: o backend hoje aceita `PUT`/`DELETE` sem validar owner/admin — isto é um risco se alguém interceptar token ou usar curl. Em médio prazo, executar uma pequena revisão de segurança no backend:
  - Garantir `DELETE /chats/:id` e `PUT /chats/:id` validem que o chamador é owner OU `isAdmin`.
  - Implementar `GET /chats?admin=true` protegido por `isAdmin`.

9) Checklist de implementação (MVP)
- [ ] Criar branch `feature/chat-leave-admin-controls`.
- [ ] Adicionar botão "Sair do Chat" em `ChatMessages.js` com fluxo `PUT /chats/:id` (remover user) e teste manual A.
- [ ] Bloquear ação se `currentChat.ownerId === user.id` com mensagem explicativa.
- [ ] Habilitar botões Edit/Delete no frontend quando `user.profile === 'admin'`.
- [ ] Adicionar feature flag e documentação de QA (passos manuais listados acima).
- [ ] (Opcional) Implementar `GET /chats?admin=true` com middleware `isAdmin`.

10) Próximos passos que posso executar agora
- Se você confirmar, eu implemento o patch frontend que:
  - adiciona botão "Sair do Chat" com todo o fluxo descrito;
  - habilita botões Edit/Delete para `user.profile === 'admin'`;
  - adiciona a feature flag e um pequeno README de testes.

-- Depois do deploy em staging e validação, podemos:
  - decidir se será necessário endurecer backend (usar `isAdmin`/owner checks) e/ou implementar `GET /chats?admin=true`.

Observações finais
------------------
- Mantive a abordagem de baixo impacto: nenhum campo será removido do banco e nenhuma migração inicial é necessária.
- O caminho proposto resolve os problemas que você descreveu sem mudanças de banco e com mudança mínima no backend (opcional) para admin listagem.

---

Se desejar, inicio agora a implementação do patch frontend (vou criar branch e codificar). Confirme e eu começo: "Implementar frontend agora" ou diga se prefere primeiro a rota `GET /chats?admin=true` (mudar o backend mínima).
