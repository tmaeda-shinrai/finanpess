# Guia de Integração com Google — Autenticação via Google Sheets

> **Objetivo:** Documentar todo o processo de autenticação e autorização utilizado na aplicação **Diárias — DETRAN/MS**, onde **somente usuários com acesso à planilha Google Sheets** (editor, viewer ou proprietário) podem acessar a aplicação web.
>
> Este guia serve como **referência para aplicações futuras** que utilizem a mesma lógica.

---

## Índice

1. [Visão Geral da Arquitetura](#1-visão-geral-da-arquitetura)
2. [Pré-requisitos](#2-pré-requisitos)
3. [Etapa 1 — Google Cloud Console (Client ID OAuth)](#3-etapa-1--google-cloud-console-client-id-oauth)
4. [Etapa 2 — Backend (Google Apps Script)](#4-etapa-2--backend-google-apps-script)
5. [Etapa 3 — Frontend (HTML + JavaScript)](#5-etapa-3--frontend-html--javascript)
6. [Etapa 4 — Deploy (Vercel + Headers COOP)](#6-etapa-4--deploy-vercel--headers-coop)
7. [Fluxo Completo de Autenticação](#7-fluxo-completo-de-autenticação)
8. [Checklist de Implementação](#8-checklist-de-implementação)
9. [Problemas Comuns e Soluções](#9-problemas-comuns-e-soluções)
10. [Considerações de Segurança](#10-considerações-de-segurança)

---

## 1. Visão Geral da Arquitetura

```
┌─────────────────────┐        ┌──────────────────────────┐        ┌──────────────────────┐
│   FRONTEND          │        │  GOOGLE APPS SCRIPT      │        │  GOOGLE SHEETS       │
│   (HTML/JS)         │        │  (Backend / API)         │        │  (Banco de Dados)    │
│                     │        │                          │        │                      │
│  1. Login Google ───┼────►   │  3. Valida ID Token      │        │                      │
│     (GIS Library)   │        │     (Google tokeninfo)   │        │                      │
│                     │        │                          │        │                      │
│  2. Envia ID Token  │        │  4. Verifica se email ───┼────►   │  Editors / Viewers   │
│     nas requisições │        │     tem acesso à         │        │  da planilha         │
│                     │        │     planilha             │        │                      │
│  6. Recebe dados ◄──┼────    │  5. Retorna dados ◄──────┼────    │  Dados das abas      │
│     ou erro         │        │     ou erro de acesso    │        │                      │
└─────────────────────┘        └──────────────────────────┘        └──────────────────────┘
```

### Princípio Central

A **planilha Google Sheets é a única fonte de verdade para permissões**. Se um usuário tem acesso à planilha (como editor, viewer, ou é o proprietário), ele pode acessar a aplicação. Caso contrário, o acesso é negado.

### Tecnologias Utilizadas

| Componente | Tecnologia | Função |
|------------|------------|--------|
| Frontend | HTML + Vanilla JS + CSS | Interface do usuário |
| Autenticação | Google Identity Services (GIS) | Login com conta Google |
| Backend/API | Google Apps Script | Validação de token + leitura de dados |
| Banco de Dados | Google Sheets | Armazenamento dos dados |
| Hospedagem | Vercel (ou qualquer host estático) | Servir o frontend |

---

## 2. Pré-requisitos

- Conta Google com acesso ao [Google Cloud Console](https://console.cloud.google.com/)
- Uma planilha Google Sheets que servirá como banco de dados
- Acesso ao [Google Apps Script](https://script.google.com)
- (Opcional) Conta na Vercel para deploy do frontend

---

## 3. Etapa 1 — Google Cloud Console (Client ID OAuth)

### 3.1. Criar um Projeto

1. Acesse [Google Cloud Console](https://console.cloud.google.com/)
2. Clique em **"Selecionar projeto"** > **"Novo Projeto"**
3. Dê um nome ao projeto (ex: `App Diárias`) e clique em **Criar**

### 3.2. Configurar a Tela de Consentimento OAuth

1. No menu lateral, vá em **APIs e Serviços** > **Tela de consentimento OAuth**
2. Selecione o tipo de usuário:
   - **Interno** → Apenas usuários do seu domínio Google Workspace (recomendado para uso corporativo)
   - **Externo** → Qualquer conta Google (necessário para contas @gmail.com)
3. Preencha os campos obrigatórios:
   - **Nome do aplicativo**: ex. `Dashboard Diárias`
   - **E-mail de suporte ao usuário**: seu email
   - **Domínios autorizados**: o domínio do frontend (ex: `suaapp.vercel.app`)
   - **Informações de contato do desenvolvedor**: seu email
4. Em **Escopos**, adicione:
   - `openid`
   - `email`
   - `profile`
5. Se for **Externo** e em modo de teste, adicione os emails que poderão testar em **Usuários de teste**
6. Salve

### 3.3. Criar Credencial OAuth 2.0 (Client ID)

1. Vá em **APIs e Serviços** > **Credenciais**
2. Clique em **"+ Criar Credenciais"** > **"ID do cliente OAuth"**
3. Tipo de aplicativo: **Aplicativo da Web**
4. Nome: ex. `Frontend Dashboard`
5. Em **Origens JavaScript autorizadas**, adicione TODAS as URLs onde o app será acessado:
   ```
   http://localhost:5500
   http://127.0.0.1:5500
   https://seuapp.vercel.app
   ```
6. Clique em **Criar**
7. **Copie o Client ID** gerado — ele tem o formato:
   ```
   XXXXXXXXX-XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX.apps.googleusercontent.com
   ```

> ⚠️ **IMPORTANTE**: O Client ID **não é um segredo**. Ele é público e será usado tanto no frontend quanto no backend. O que importa é a validação do token no backend.

---

## 4. Etapa 2 — Backend (Google Apps Script)

O backend é um Google Apps Script vinculado (ou não) à planilha. Ele tem duas responsabilidades:

1. **Validar o ID Token** recebido do frontend
2. **Verificar se o email do usuário tem acesso à planilha**

### 4.1. Criar o Projeto Apps Script

1. Acesse [script.google.com](https://script.google.com)
2. Crie um **novo projeto**
3. Renomeie para algo descritivo (ex: `API Dashboard Diárias`)

### 4.2. Código do Backend (`Code.gs`)

#### Constantes Globais

```javascript
// ID da planilha Google Sheets (extraído da URL da planilha)
// Ex: https://docs.google.com/spreadsheets/d/ESTE_É_O_ID/edit
const SPREADSHEET_ID = 'SEU_SPREADSHEET_ID_AQUI';

// Mesmo Client ID criado no Google Cloud Console
const GOOGLE_CLIENT_ID = 'SEU_CLIENT_ID_AQUI.apps.googleusercontent.com';
```

#### Função: Verificar Token Google

```javascript
/**
 * Verifica o ID Token do Google e retorna o email do usuário.
 * Usa a API pública do Google (tokeninfo) para validar.
 *
 * @param {string} idToken - Token JWT recebido do frontend
 * @returns {string} Email do usuário autenticado
 * @throws {Error} Se o token for inválido
 */
function verificarTokenGoogle(idToken) {
  if (!idToken) {
    throw new Error('Token de autenticação ausente.');
  }

  try {
    // Chama a API do Google para validar o token
    const response = UrlFetchApp.fetch(
      'https://oauth2.googleapis.com/tokeninfo?id_token=' + idToken,
      { muteHttpExceptions: true }
    );

    const statusCode = response.getResponseCode();
    if (statusCode !== 200) {
      throw new Error('Token inválido ou expirado.');
    }

    const payload = JSON.parse(response.getContentText());

    // IMPORTANTE: Verifica se o token foi emitido para o nosso Client ID
    // Isso impede que tokens de outros apps sejam reutilizados aqui
    if (payload.aud !== GOOGLE_CLIENT_ID) {
      throw new Error('Token não foi emitido para esta aplicação.');
    }

    // Verifica se o token não está expirado
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && parseInt(payload.exp) < now) {
      throw new Error('Token expirado. Faça login novamente.');
    }

    return payload.email;
  } catch (error) {
    if (error.message.includes('Token')) {
      throw error;
    }
    throw new Error('Falha ao verificar autenticação: ' + error.message);
  }
}
```

#### Função: Verificar Acesso à Planilha

```javascript
/**
 * Verifica se o email tem acesso (viewer, editor ou owner) à planilha.
 * Esta é a função-chave que garante que apenas usuários autorizados
 * acessem os dados da aplicação.
 *
 * @param {string} email - Email do usuário autenticado
 * @returns {boolean} true se tem acesso
 */
function emailTemAcessoAPlanilha(email) {
  try {
    const file = DriveApp.getFileById(SPREADSHEET_ID);
    const emailLower = email.toLowerCase();

    // Verifica se é editor
    const editors = file.getEditors();
    for (let i = 0; i < editors.length; i++) {
      if (editors[i].getEmail().toLowerCase() === emailLower) {
        return true;
      }
    }

    // Verifica se é viewer
    const viewers = file.getViewers();
    for (let i = 0; i < viewers.length; i++) {
      if (viewers[i].getEmail().toLowerCase() === emailLower) {
        return true;
      }
    }

    // Verifica se é o proprietário
    const owner = file.getOwner();
    if (owner && owner.getEmail().toLowerCase() === emailLower) {
      return true;
    }

    return false;
  } catch (error) {
    Logger.log('Erro ao verificar acesso: ' + error.message);
    return false;
  }
}
```

#### Função: Handler Principal (`doGet`)

```javascript
/**
 * Handler para requisições GET — ponto de entrada da API.
 * Toda requisição passa por autenticação + autorização antes de processar.
 */
function doGet(e) {
  const params = e.parameter;
  const idToken = params.id_token;

  // 1. AUTENTICAÇÃO: Verifica o token do Google
  let email;
  try {
    email = verificarTokenGoogle(idToken);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({
        error: 'Acesso negado. ' + error.message
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 2. AUTORIZAÇÃO: Verifica se o email tem acesso à planilha
  if (!emailTemAcessoAPlanilha(email)) {
    return ContentService
      .createTextOutput(JSON.stringify({
        error: 'Acesso negado. Seu email (' + email + ') não tem permissão.'
      }))
      .setMimeType(ContentService.MimeType.JSON);
  }

  // 3. PROCESSAMENTO: Retorna os dados solicitados
  const action = params.action || 'getAll';

  try {
    let result;
    switch (action) {
      case 'getSheet':
        result = getSheetData(params.sheet);
        break;
      case 'getAll':
        result = getAllData();
        break;
      default:
        result = { error: 'Ação não reconhecida: ' + action };
    }

    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService
      .createTextOutput(JSON.stringify({ error: error.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

#### Função: Leitura de Dados da Planilha

```javascript
/**
 * Retorna os dados de uma aba como array de objetos.
 * A primeira linha é usada como cabeçalho (chaves do objeto).
 */
function getSheetData(sheetName) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(sheetName);

  if (!sheet) {
    throw new Error('Aba não encontrada: ' + sheetName);
  }

  const data = sheet.getDataRange().getValues();

  if (data.length < 2) return [];

  const headers = data[0].map(h => String(h).trim());
  const rows = [];

  for (let i = 1; i < data.length; i++) {
    const row = {};
    let hasValue = false;

    for (let j = 0; j < headers.length; j++) {
      let value = data[i][j];

      // Converte datas para string ISO
      if (value instanceof Date) {
        value = Utilities.formatDate(
          value,
          Session.getScriptTimeZone(),
          'yyyy-MM-dd'
        );
      }

      // Converte booleanos
      if (typeof value === 'string') {
        if (value.toUpperCase() === 'TRUE') value = true;
        else if (value.toUpperCase() === 'FALSE') value = false;
      }

      row[headers[j]] = value;
      if (value !== '' && value !== null && value !== undefined) {
        hasValue = true;
      }
    }

    if (hasValue) rows.push(row);
  }

  return rows;
}
```

#### Função de Autorização Inicial (executar 1x)

```javascript
/**
 * ⭐ EXECUTE ESTA FUNÇÃO UMA VEZ antes de fazer o deploy.
 * Ela dispara as caixas de diálogo de autorização para:
 *   - UrlFetchApp (necessário para validar tokens)
 *   - DriveApp (necessário para verificar permissões da planilha)
 *   - SpreadsheetApp (necessário para ler os dados)
 */
function autorizarPermissoes() {
  var response = UrlFetchApp.fetch(
    'https://oauth2.googleapis.com/tokeninfo?id_token=test',
    { muteHttpExceptions: true }
  );
  Logger.log('UrlFetchApp: OK (status ' + response.getResponseCode() + ')');

  var file = DriveApp.getFileById(SPREADSHEET_ID);
  Logger.log('DriveApp: OK (' + file.getName() + ')');

  var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  Logger.log('SpreadsheetApp: OK (' + ss.getName() + ')');

  Logger.log('✅ Todas as permissões autorizadas com sucesso!');
}
```

### 4.3. Deploy do Apps Script

1. No editor do Apps Script, selecione `autorizarPermissoes` no dropdown de funções e clique em **▶ Executar**
2. Aceite **todas as permissões** no diálogo que aparecer
3. Clique em **Implantar** > **Nova implantação**
4. Configure:
   - **Tipo**: App da Web
   - **Executar como**: Eu (sua conta)
   - **Quem tem acesso**: **Qualquer pessoa**
5. Clique em **Implantar**
6. **Copie a URL** gerada (formato: `https://script.google.com/macros/s/XXXX/exec`)

> ⚠️ **"Qualquer pessoa" no deploy**: Sim, a URL é pública, mas a segurança está no token. Sem um ID Token válido de um usuário com acesso à planilha, a API retorna erro.

> ⚠️ **Atualizar o deploy**: Ao modificar o código, vá em **Implantar** > **Gerenciar implantações** > **Editar** > selecione **Nova versão** > **Implantar**. Se apenas clicar em "Implantar", a versão antiga continua ativa.

---

## 5. Etapa 3 — Frontend (HTML + JavaScript)

### 5.1. Carregar a Biblioteca GIS no HTML

```html
<head>
  <!-- Google Identity Services -->
  <script src="https://accounts.google.com/gsi/client" async defer></script>
</head>
```

### 5.2. Tela de Login no HTML

```html
<!-- Login Screen (visível até o usuário se autenticar) -->
<div id="login-screen">
  <div class="login-card">
    <span class="login-icon">🔐</span>
    <h2>Nome da Aplicação</h2>
    <p class="login-subtitle">
      Acesso restrito aos colaboradores autorizados.<br>
      Faça login com sua conta Google institucional.
    </p>
    <!-- O botão do Google é renderizado aqui automaticamente -->
    <div id="google-btn-container"></div>
    <div id="login-error" class="login-error"></div>
    <p class="login-footer">
      🔒 Apenas usuários autorizados podem acessar.
    </p>
  </div>
</div>

<!-- App principal (oculto até o login) -->
<div class="app-container" style="display: none;">
  <!-- Header com info do usuário e botão de logout -->
  <header>
    <div id="user-info" class="user-info" style="display: none;">
      <img class="user-avatar" src="" alt="Avatar" referrerpolicy="no-referrer">
      <span class="user-email"></span>
    </div>
    <button id="logout-btn" title="Sair">Sair</button>
  </header>

  <!-- Conteúdo da aplicação -->
  <!-- ... -->
</div>
```

### 5.3. JavaScript de Autenticação (`api.js`)

```javascript
/**
 * api.js — Autenticação + Comunicação com backend
 */

// URL do deploy do Google Apps Script
const API_URL = 'https://script.google.com/macros/s/SEU_DEPLOY_ID/exec';

// Client ID (o mesmo do Google Cloud Console e do Code.gs)
const GOOGLE_CLIENT_ID = 'SEU_CLIENT_ID.apps.googleusercontent.com';

// Token e perfil em memória (NUNCA salvar em localStorage!)
let _idToken = null;
let _userProfile = null;

// ══════════════════════════════════════
//  Inicialização do Google Identity Services
// ══════════════════════════════════════

/**
 * Inicializa o GIS com o Client ID e define o callback de login.
 */
function initGoogleAuth() {
  if (typeof google === 'undefined' || !google.accounts) {
    console.error('Google Identity Services não carregou.');
    return;
  }

  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback: handleCredentialResponse, // Chamado após login
    auto_select: false,                 // Não auto-logar
    cancel_on_tap_outside: true,
  });
}

/**
 * Renderiza o botão "Entrar com Google" dentro do container.
 */
function triggerGoogleLogin() {
  const btnContainer = document.getElementById('google-btn-container');
  if (btnContainer) {
    google.accounts.id.renderButton(btnContainer, {
      type: 'standard',
      shape: 'rectangular',
      theme: 'filled_blue',
      size: 'large',
      text: 'signin_with',
      locale: 'pt-BR',
      width: 280,
    });
  }
}

// ══════════════════════════════════════
//  Callback pós-login
// ══════════════════════════════════════

/**
 * Executado automaticamente pelo GIS após login bem-sucedido.
 * Recebe o credential (ID Token JWT) do Google.
 */
function handleCredentialResponse(response) {
  if (!response.credential) {
    showLoginError('Falha ao autenticar. Tente novamente.');
    return;
  }

  // Armazena o token apenas em memória
  _idToken = response.credential;

  // Decodifica o JWT para exibir dados do perfil (nome, foto, email)
  const payload = parseJwt(_idToken);
  _userProfile = {
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
  };

  // Transição: esconde login, mostra app
  hideLoginScreen();
  showUserInfo();

  // Agora inicializa a aplicação (carrega dados)
  initApp();
}

/**
 * Decodifica o payload de um JWT sem verificar assinatura.
 * Usado apenas para exibição no frontend — a verificação
 * real acontece no backend.
 */
function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch {
    return {};
  }
}

// ══════════════════════════════════════
//  Logout
// ══════════════════════════════════════

function handleLogout() {
  _idToken = null;
  _userProfile = null;

  // Desabilita auto-select para próximo acesso
  google.accounts.id.disableAutoSelect();

  showLoginScreen();
  hideUserInfo();
}

// ══════════════════════════════════════
//  Chamadas à API (com token)
// ══════════════════════════════════════

/**
 * Toda chamada à API inclui o id_token como parâmetro.
 * O backend valida o token antes de retornar dados.
 */
async function fetchAllData(forceRefresh = false) {
  if (!_idToken) {
    throw new Error('Usuário não autenticado.');
  }

  const response = await fetch(
    `${API_URL}?action=getAll&id_token=${encodeURIComponent(_idToken)}`
  );

  const data = await response.json();

  // Se o backend retornou erro de acesso, faz logout
  if (data.error) {
    if (data.error.includes('Acesso negado') || data.error.includes('Token')) {
      handleLogout();
      showLoginError(data.error);
    }
    throw new Error(data.error);
  }

  return data;
}

// ══════════════════════════════════════
//  Controle de UI (login screen)
// ══════════════════════════════════════

function hideLoginScreen() {
  const loginScreen = document.getElementById('login-screen');
  const appContainer = document.querySelector('.app-container');
  if (loginScreen) loginScreen.classList.add('hidden');
  if (appContainer) appContainer.style.display = '';
}

function showLoginScreen() {
  const loginScreen = document.getElementById('login-screen');
  const appContainer = document.querySelector('.app-container');
  if (loginScreen) loginScreen.classList.remove('hidden');
  if (appContainer) appContainer.style.display = 'none';
  triggerGoogleLogin(); // Re-renderiza o botão
}

function showUserInfo() {
  const el = document.getElementById('user-info');
  if (el && _userProfile) {
    el.querySelector('.user-avatar').src = _userProfile.picture || '';
    el.querySelector('.user-email').textContent = _userProfile.email || '';
    el.style.display = 'flex';
  }
}

function hideUserInfo() {
  const el = document.getElementById('user-info');
  if (el) el.style.display = 'none';
}

function isAuthenticated() {
  return _idToken !== null;
}
```

### 5.4. Inicialização no HTML

```html
<script>
  window.addEventListener('load', () => {
    // Aguarda o GIS carregar (pode demorar alguns ms)
    const waitForGIS = setInterval(() => {
      if (typeof google !== 'undefined' && google.accounts) {
        clearInterval(waitForGIS);
        initGoogleAuth();
        triggerGoogleLogin();
      }
    }, 100);

    // Timeout de segurança (10 segundos)
    setTimeout(() => clearInterval(waitForGIS), 10000);

    // Botão de logout
    document.getElementById('logout-btn')
      ?.addEventListener('click', handleLogout);
  });
</script>
```

---

## 6. Etapa 4 — Deploy (Vercel + Headers COOP)

### 6.1. Problema: Cross-Origin-Opener-Policy

O Google Identity Services abre popups para autenticação. Por padrão, muitos hosts (incluindo Vercel) configuram headers que bloqueiam esses popups. É necessário configurar o header `Cross-Origin-Opener-Policy` como `same-origin-allow-popups`.

### 6.2. Configuração do `vercel.json`

Crie na raiz do projeto um arquivo `vercel.json`:

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Cross-Origin-Opener-Policy",
          "value": "same-origin-allow-popups"
        }
      ]
    }
  ]
}
```

> 💡 Se usar outro host (Netlify, Cloudflare Pages, etc.), configure o equivalente no `_headers`, `_redirects`, ou nas configurações do painel.

### 6.3. Origens Autorizadas

Após o deploy, adicione a URL de produção nas **Origens JavaScript autorizadas** do Client ID no Google Cloud Console:

```
https://seuapp.vercel.app
```

---

## 7. Fluxo Completo de Autenticação

```
USUÁRIO                    FRONTEND                   GOOGLE                    BACKEND (GAS)
  │                           │                          │                          │
  │  Acessa a aplicação       │                          │                          │
  ├──────────────────────────►│                          │                          │
  │                           │                          │                          │
  │  Vê tela de login         │                          │                          │
  │◄──────────────────────────┤                          │                          │
  │                           │                          │                          │
  │  Clica "Entrar com Google"│                          │                          │
  ├──────────────────────────►│                          │                          │
  │                           │  Abre popup de login     │                          │
  │                           ├─────────────────────────►│                          │
  │                           │                          │                          │
  │  Seleciona conta Google   │                          │                          │
  ├──────────────────────────────────────────────────────►│                          │
  │                           │                          │                          │
  │                           │  Recebe ID Token (JWT)   │                          │
  │                           │◄─────────────────────────┤                          │
  │                           │                          │                          │
  │                           │  Envia request com token │                          │
  │                           ├─────────────────────────────────────────────────────►│
  │                           │                          │                          │
  │                           │                          │  Valida token via        │
  │                           │                          │  tokeninfo API           │
  │                           │                          │◄─────────────────────────┤
  │                           │                          ├─────────────────────────►│
  │                           │                          │                          │
  │                           │                          │  Verifica email nos      │
  │                           │                          │  editors/viewers/owner   │
  │                           │                          │  da planilha             │
  │                           │                          │                          │
  │                           │  Retorna dados JSON      │                          │
  │                           │◄─────────────────────────────────────────────────────┤
  │                           │                          │                          │
  │  Vê a aplicação           │                          │                          │
  │◄──────────────────────────┤                          │                          │
```

### Resumo do Fluxo

1. **Usuário** acessa a URL → vê a **tela de login**
2. **Usuário** clica em "Entrar com Google" → popup do Google
3. **Google** autentica e retorna um **ID Token (JWT)**
4. **Frontend** armazena token em memória e envia nas requests
5. **Backend** (GAS) recebe o token e:
   - a) Valida na API `tokeninfo` do Google
   - b) Verifica se `payload.aud` = nosso Client ID
   - c) Usa `DriveApp.getFileById()` para checar se o email é editor/viewer/owner
6. Se tudo OK → retorna os dados. Senão → retorna `{ error: "Acesso negado" }`
7. **Frontend** exibe os dados ou mostra erro e volta para login

---

## 8. Checklist de Implementação

Use esta lista ao implementar a mesma lógica em uma nova aplicação:

### Google Cloud Console
- [ ] Criar projeto no Google Cloud Console
- [ ] Configurar Tela de Consentimento OAuth
- [ ] Criar credencial OAuth 2.0 (Client ID para app web)
- [ ] Adicionar origens autorizadas (localhost + produção)

### Backend (Google Apps Script)
- [ ] Criar projeto no Apps Script
- [ ] Definir constantes: `SPREADSHEET_ID` e `GOOGLE_CLIENT_ID`
- [ ] Implementar `verificarTokenGoogle()` — valida JWT via tokeninfo API
- [ ] Implementar `emailTemAcessoAPlanilha()` — checa editors/viewers/owner
- [ ] Implementar `doGet()` com autenticação + autorização antes do processamento
- [ ] Implementar `getSheetData()` para leitura dos dados
- [ ] Executar `autorizarPermissoes()` manualmente (1ª vez)
- [ ] Fazer deploy como App da Web (executar como: Eu / acesso: Qualquer pessoa)
- [ ] Copiar a URL do deploy

### Frontend
- [ ] Incluir script do GIS: `https://accounts.google.com/gsi/client`
- [ ] Definir `GOOGLE_CLIENT_ID` e `API_URL` no JS
- [ ] Implementar `initGoogleAuth()` + `triggerGoogleLogin()`
- [ ] Implementar `handleCredentialResponse()` (callback do login)
- [ ] Implementar `parseJwt()` para decodificar perfil
- [ ] Implementar `handleLogout()`
- [ ] Criar tela de login com `<div id="google-btn-container">`
- [ ] Criar UI de info do usuário (avatar + email) no header
- [ ] Enviar `id_token` em todas as chamadas à API
- [ ] Tratar erros de acesso (redirecionar para login)
- [ ] Token armazenado apenas em memória (`let _idToken`)

### Deploy
- [ ] Configurar header `Cross-Origin-Opener-Policy: same-origin-allow-popups`
- [ ] Adicionar URL de produção nas origens autorizadas do Client ID
- [ ] Testar login com usuário autorizado
- [ ] Testar login com usuário NÃO autorizado (deve ver erro)

---

## 9. Problemas Comuns e Soluções

### ❌ Botão do Google não aparece

**Causa**: A biblioteca GIS não carregou ou o `initGoogleAuth()` não foi chamado.

**Solução**: Verificar se o script está carregado e usar o `setInterval` para aguardar:
```javascript
const waitForGIS = setInterval(() => {
  if (typeof google !== 'undefined' && google.accounts) {
    clearInterval(waitForGIS);
    initGoogleAuth();
    triggerGoogleLogin();
  }
}, 100);
```

### ❌ Erro "popup_closed_by_user" ou popup não abre

**Causa**: Header `Cross-Origin-Opener-Policy` bloqueando popups.

**Solução**: Configurar no host:
```json
{ "Cross-Origin-Opener-Policy": "same-origin-allow-popups" }
```

### ❌ "Token não foi emitido para esta aplicação"

**Causa**: O `GOOGLE_CLIENT_ID` no backend é diferente do frontend.

**Solução**: Usar **exatamente o mesmo** Client ID em `api.js` e `Code.gs`.

### ❌ "Acesso negado" mesmo com acesso à planilha

**Possíveis causas**:
1. O Apps Script não tem permissão do DriveApp → Execute `autorizarPermissoes()`
2. O deploy não foi atualizado → Faça um novo deploy com **"Nova versão"**
3. O acesso à planilha é via link ("Qualquer pessoa com link") → Isso **não** funciona; o usuário precisa estar listado como editor/viewer individualmente

### ❌ "idpiframe_initialization_failed"

**Causa**: Origem não autorizada no Google Cloud Console.

**Solução**: Adicionar a URL exata (com protocolo) nas Origens JavaScript autorizadas:
```
http://localhost:5500   (não https se for HTTP)
http://127.0.0.1:5500   (ambos, se necessário)
```

### ❌ Token expira e usuário perde acesso

**Causa**: O ID Token do Google tem validade de ~1 hora.

**Solução atual**: Quando o backend retorna erro de token expirado, o frontend faz logout e mostra a tela de login novamente. Para melhorar a UX, pode-se implementar refresh silencioso com `google.accounts.id.prompt()`.

---

## 10. Considerações de Segurança

### ✅ O que esta arquitetura garante

| Aspecto | Proteção |
|---------|----------|
| **Autenticação** | Token JWT validado no backend via API do Google |
| **Autorização** | Acesso verificado contra lista real de editors/viewers da planilha |
| **Token em memória** | Não persiste em localStorage/cookies (evita XSS) |
| **Validação de audience** | `payload.aud === GOOGLE_CLIENT_ID` impede reutilização de tokens de outros apps |
| **Expiração** | Token com TTL de ~1h, verificado no backend |

### ⚠️ Limitações conhecidas

| Aspecto | Limitação |
|---------|-----------|
| **Compartilhamento por link** | Se a planilha está "Qualquer pessoa com link", o check de acesso não funciona — o usuário precisa estar **explicitamente** listado |
| **Cache de permissões** | A verificação é em tempo real (via DriveApp), então remover acesso à planilha bloqueia o usuário na próxima request |
| **Renovação de token** | Não há renovação automática; ao expirar, o usuário refaz login |
| **Rate limiting do GAS** | Google Apps Script tem [quotas](https://developers.google.com/apps-script/guides/services/quotas) — cuidado com muitos usuários simultâneos |

### 🔒 Boas práticas adotadas

1. **Nunca armazenar token em localStorage** — vulnerável a XSS
2. **Validar token no servidor** — nunca confiar apenas no frontend
3. **Verificar `aud` do token** — garantir que é do nosso app
4. **Usar `encodeURIComponent` no token** — evitar problemas com caracteres especiais na URL
5. **Mensagens de erro genéricas** — não expor detalhes internos ao usuário
6. **Logout limpa tudo** — token, perfil e cache

---

## Referência Rápida — Arquivos e Suas Responsabilidades

| Arquivo | Responsabilidade |
|---------|-----------------|
| `index.html` | Estrutura da tela de login + inicialização do GIS |
| `js/api.js` | Autenticação Google + chamadas à API com token |
| `js/app.js` | Inicialização da aplicação após login |
| `css/styles.css` | Estilos da tela de login + animações |
| `google-apps-script/Code.gs` | Validação de token + verificação de acesso + leitura de dados |
| `vercel.json` | Header COOP para permitir popup do Google |

---

> **Última atualização**: Abril/2026  
> **Aplicação de referência**: Diárias — DETRAN/MS (`appdiarias`)
