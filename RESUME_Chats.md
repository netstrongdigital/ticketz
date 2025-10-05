# RESUMO - Chat Interno do Ticketz

## Visão Geral do Projeto

O **Ticketz** é um sistema de CRM/helpdesk derivado do projeto Whaticket Community, que utiliza WhatsApp como meio de comunicação com clientes. O projeto possui uma arquitetura full-stack com:

- **Backend**: Node.js + TypeScript + Express + Sequelize (PostgreSQL)
- **Frontend**: React.js + Material-UI
- **Comunicação em tempo real**: Socket.IO
- **Containerização**: Docker

## Arquitetura do Chat Interno

O sistema de chat interno permite comunicação entre usuários da equipe dentro da plataforma, separado dos atendimentos via WhatsApp.

### 1. Estrutura do Banco de Dados

#### Tabela `Chats`
```sql
- id (INTEGER, PK, AUTO_INCREMENT)
- uuid (STRING) - UUID único para identificação pública
- title (TEXT) - Título da conversa
- ownerId (INTEGER, FK → Users) - Proprietário/criador do chat
- lastMessage (TEXT) - Última mensagem enviada
- companyId (INTEGER, FK → Companies) - Empresa à qual pertence
- createdAt (DATE)
- updatedAt (DATE)
```

#### Tabela `ChatUsers`
```sql
- id (INTEGER, PK, AUTO_INCREMENT)
- chatId (INTEGER, FK → Chats) - Referência ao chat
- userId (INTEGER, FK → Users) - Usuário participante
- unreads (INTEGER) - Contador de mensagens não lidas
- createdAt (DATE)
- updatedAt (DATE)
```

#### Tabela `ChatMessages`
```sql
- id (INTEGER, PK, AUTO_INCREMENT)
- chatId (INTEGER, FK → Chats) - Chat de destino
- senderId (INTEGER, FK → Users) - Remetente da mensagem
- message (TEXT) - Conteúdo da mensagem
- mediaPath (STRING) - Caminho para arquivos de mídia
- mediaType (STRING) - Tipo de mídia (text, image, audio, etc.)
- mediaName (STRING) - Nome original do arquivo
- createdAt (DATE)
- updatedAt (DATE)
```

### 2. Backend - API e Serviços

#### Controller (`ChatController.ts`)
**Endpoints disponíveis:**
- `GET /chats` - Lista chats do usuário
- `GET /chats/:id` - Detalhes de um chat específico
- `GET /chats/:id/messages` - Lista mensagens de um chat
- `POST /chats` - Criar novo chat
- `POST /chats/:id/messages` - Enviar mensagem (com suporte a mídia)
- `POST /chats/:id/read` - Marcar mensagens como lidas
- `PUT /chats/:id` - Atualizar chat
- `DELETE /chats/:id` - Excluir chat

#### Serviços principais

**CreateService.ts**
- Cria novo chat com título e lista de usuários
- Adiciona automaticamente o criador como participante
- Estabelece relacionamentos na tabela ChatUsers

**ListService.ts**
- Lista chats do usuário logado com paginação
- Inclui informações dos participantes e proprietário
- Ordenação por data de criação (mais recente primeiro)

**CreateMessageService.ts**
- Cria nova mensagem no chat
- Atualiza contador de mensagens não lidas
- Atualiza "lastMessage" do chat
- Suporte para diferentes tipos de mídia

**FindMessages.ts**
- Busca mensagens de um chat específico
- Paginação (20 mensagens por página)
- Verificação de autorização (usuário deve estar no chat)
- Ordenação por data de criação

#### Socket.IO - Eventos em Tempo Real

**Eventos emitidos:**
- `company-{companyId}-chat-user-{userId}` - Notificações de chat para usuário específico
- `company-{companyId}-chat-{chatId}` - Eventos específicos do chat
- `company-{companyId}-chat` - Eventos gerais de chat

**Ações dos eventos:**
- `create` - Novo chat criado
- `update` - Chat atualizado
- `delete` - Chat excluído
- `new-message` - Nova mensagem recebida

### 3. Frontend - Interface de Usuário

#### Estrutura de Componentes

**`/pages/Chat/index.js`** - Componente principal
- Gerencia estado dos chats e mensagens
- Controla modals de criação/edição
- Integração com Socket.IO para updates em tempo real
- Sistema de abas (lista de chats vs mensagens)

**`ChatModal`** - Modal para criar/editar chats
- Formulário com título e seleção de usuários
- Filtro de usuários disponíveis
- Validações de campos obrigatórios

**`ChatList.js`** - Lista de conversas
- Exibe chats com título, última mensagem e timestamp
- Indicador visual de mensagens não lidas
- Navegação entre chats
- Ações de edição e exclusão

**`ChatMessages.js`** - Área de mensagens
- Exibição de mensagens em thread
- Input para envio de texto
- Suporte para anexos (imagens, áudios, documentos)
- Gravação de áudio
- Scroll automático para novas mensagens
- Interface responsiva

#### Funcionalidades do Frontend

1. **Listagem de Chats**
   - Paginação infinita
   - Contador de mensagens não lidas
   - Última mensagem e timestamp
   - Indicador visual do chat ativo

2. **Envio de Mensagens**
   - Texto simples
   - Anexos de mídia (múltiplos arquivos)
   - Gravação de áudio em tempo real
   - Preview de imagens antes do envio

3. **Tempo Real**
   - Recebimento instantâneo de mensagens
   - Atualização automática de contadores
   - Notificações visuais

4. **Responsividade**
   - Adaptação para diferentes tamanhos de tela
   - Interface móvel otimizada

### 4. Fluxo de Funcionamento

#### Criação de Chat
1. Usuário clica em "Novo Chat"
2. Preenche título e seleciona participantes
3. Backend cria registro em `Chats` e `ChatUsers`
4. Socket.IO notifica todos os participantes
5. Chat aparece na lista de todos os usuários selecionados

#### Envio de Mensagem
1. Usuário digita mensagem ou anexa arquivo
2. Frontend envia POST para `/chats/:id/messages`
3. Backend cria registro em `ChatMessages`
4. Atualiza contadores de não lidas e lastMessage
5. Socket.IO transmite mensagem para todos os participantes
6. Interface atualiza em tempo real

#### Marcação como Lida
1. Usuário acessa chat com mensagens não lidas
2. Frontend envia POST para `/chats/:id/read`
3. Backend zera contador `unreads` do usuário
4. Socket.IO notifica mudança de estado

### 5. Recursos Implementados

✅ **Funcionalidades Básicas**
- Criação, edição e exclusão de chats
- Envio de mensagens de texto
- Suporte a anexos (imagens, áudios, documentos)
- Sistema de mensagens não lidas
- Tempo real com Socket.IO

✅ **Funcionalidades Avançadas**
- Gravação de áudio integrada
- Preview de imagens
- Paginação de mensagens
- Interface responsiva
- Persistência de dados

✅ **Segurança**
- Autenticação obrigatória
- Verificação de participação em chats
- Isolamento por empresa (companyId)

### 6. Limitações Identificadas

1. **Funcionalidades em Falta**
   - Sistema de notificações push
   - Busca de mensagens
   - Menções (@usuário)
   - Reações a mensagens
   - Encaminhamento de mensagens
   - Histórico de edições
   - Status online/offline dos usuários

2. **Melhorias de UX**
   - Indicadores de mensagem enviada/entregue/lida
   - Typing indicators
   - Melhor organização visual das conversas
   - Filtros e ordenação avançada

3. **Performance**
   - Cache de mensagens no frontend
   - Lazy loading de anexos
   - Compressão de imagens
   - Otimização de queries

### 7. Tecnologias e Dependências

**Backend:**
- `socket.io` - Comunicação em tempo real
- `multer` - Upload de arquivos
- `sequelize` - ORM para banco de dados
- `uuid` - Geração de identificadores únicos

**Frontend:**
- `@material-ui/core` - Componentes de interface
- `socket.io-client` - Cliente Socket.IO
- `mic-recorder-to-mp3` - Gravação de áudio
- `react-modal-image` - Preview de imagens

### 8. Padrões e Arquitetura

- **MVC Pattern** no backend (Models, Controllers, Services)
- **Component-based** no frontend (React)
- **Real-time communication** com Socket.IO  
- **RESTful API** para operações CRUD
- **Database migrations** para versionamento do schema
- **Docker containerization** para deploy

---

## Conclusão

O sistema de chat interno do Ticketz é bem estruturado e funcional, oferecendo uma base sólida para comunicação interna da equipe. A arquitetura é escalável e bem organizada, com separação clara de responsabilidades entre frontend e backend.

O sistema atende aos requisitos básicos de um chat corporativo, com suporte a mensagens de texto, anexos, tempo real e controle de usuários. Há espaço para melhorias em termos de funcionalidades avançadas e otimizações de performance, mas a base atual é robusta e bem implementada.