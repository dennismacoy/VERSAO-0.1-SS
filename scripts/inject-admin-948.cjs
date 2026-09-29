/**
 * Script para injetar o usuário Administrador no Realtime Database da Filial 948.
 * Execução: npm run seed:admin:948  (ou  node scripts/inject-admin-948.cjs)
 */

const RTDB_URL = "https://atacadaoss948-default-rtdb.firebaseio.com";

const adminUser = {
  nome: "Administrador 948",
  usuario: "admin",
  email: "admin@atacadaoss948.com",
  senha: "javaitarde",
  role: "admin",
  cargo: "Administrador",
  createdAt: new Date().toISOString()
};

const defaultPermissions = {
  // Páginas
  'Acesso Dashboard': ['admin', 'gerente', 'vendedor', 'repositor', 'promotor', 'operador'],
  'Acesso Consulta': ['admin', 'gerente', 'repositor', 'vendedor', 'promotor', 'operador', 'clientes'],
  'view_consulta': ['admin', 'gerente', 'repositor', 'vendedor', 'promotor', 'operador', 'clientes'],
  'allow_sheets_sync': ['admin', 'gerente', 'repositor', 'vendedor', 'promotor', 'operador', 'clientes'],
  'Acesso Pedidos': ['clientes', 'admin', 'gerente', 'vendedor'],
  'Acesso Requisições': ['admin', 'gerente', 'vendedor'],
  'Acesso Pre-Venda': ['admin', 'gerente', 'vendedor'],
  'Acesso Separacao': ['admin', 'gerente', 'repositor'],
  'Acesso Gestao Administrativa': ['admin', 'gerente', 'vendedor', 'repositor'],
  'gestao_administrativa': ['admin', 'gerente', 'vendedor', 'repositor'],
  'Acesso Relatorios': ['admin', 'gerente', 'vendedor'],
  'Acesso Configuracoes': ['admin', 'gerente', 'repositor', 'vendedor', 'clientes'],
  'Acesso Telefones': ['admin', 'gerente', 'repositor', 'vendedor', 'promotor', 'operador'],
  'Acessar Sincronização Master': ['admin'],

  // Dashboard Cards
  'Ver Separacoes Abertas': ['admin', 'gerente', 'repositor'],
  'Ver Requisicoes Pendentes': ['admin', 'gerente'],
  'Ver Itens ISV': ['admin', 'gerente', 'vendedor'],
  'Ver Itens Idade': ['admin', 'gerente', 'vendedor'],
  'Ver Total Paletes': ['admin', 'gerente', 'repositor'],
  'Ver Valor Estoque': ['admin', 'gerente'],

  // Consulta Details (Bottom Sheet)
  'Ver Card Geral': ['admin', 'gerente', 'vendedor', 'repositor', 'promotor', 'operador', 'clientes'],
  'Ver Card Extras': ['admin', 'gerente'],

  // Botões
  'Botao Enviar WPP': ['admin', 'gerente', 'vendedor'],
  'Botao Ligar Comprador': ['admin', 'gerente'],
  'Botao Gerar PDF': ['admin', 'gerente', 'vendedor'],
  'Criar Prevenda': ['admin', 'gerente', 'vendedor'],
  updatedAt: new Date().toISOString()
};

async function injectAdmin() {
  console.log(`[Filial 948] Conectando ao Realtime Database em: ${RTDB_URL}`);

  try {
    // 1. Verificar se usuário já existe
    const getRes = await fetch(`${RTDB_URL}/usuarios.json`);
    if (!getRes.ok) {
      throw new Error(`Falha ao consultar banco: HTTP ${getRes.status} ${getRes.statusText}`);
    }

    const existingUsers = await getRes.json();
    let alreadyExists = false;

    if (existingUsers && typeof existingUsers === 'object') {
      for (const [key, val] of Object.entries(existingUsers)) {
        if (
          val.email?.toLowerCase() === adminUser.email.toLowerCase() ||
          val.usuario?.toLowerCase() === adminUser.usuario.toLowerCase()
        ) {
          console.log(`[Aviso] Usuário já existe com ID "${key}":`, val);
          alreadyExists = true;
          // Atualiza a senha e role para garantir
          const updateRes = await fetch(`${RTDB_URL}/usuarios/${key}.json`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              senha: adminUser.senha,
              role: adminUser.role,
              updatedAt: new Date().toISOString()
            })
          });
          if (updateRes.ok) {
            console.log(`[Sucesso] Credenciais atualizadas com sucesso para o ID: ${key}`);
          }
          break;
        }
      }
    }

    if (!alreadyExists) {
      // Inserir novo usuário
      const postRes = await fetch(`${RTDB_URL}/usuarios.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(adminUser)
      });

      if (!postRes.ok) {
        throw new Error(`Erro ao inserir usuário: HTTP ${postRes.status}`);
      }

      const postData = await postRes.json();
      console.log(`[Sucesso] Administrador criado com sucesso! Firebase ID: ${postData.name}`);
      
      // Atualizar firebaseId dentro do próprio registro
      await fetch(`${RTDB_URL}/usuarios/${postData.name}.json`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ firebaseId: postData.name })
      });
    }

    // 2. Inicializar matriz de permissões se vazia
    const permRes = await fetch(`${RTDB_URL}/permissoes.json`);
    const permData = await permRes.json();
    if (!permData) {
      console.log('[Info] Inicializando matriz de permissões padrão...');
      await fetch(`${RTDB_URL}/permissoes.json`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(defaultPermissions)
      });
      console.log('[Sucesso] Permissões padrão inicializadas.');
    } else {
      console.log('[Info] Matriz de permissões já existe no banco.');
    }

    console.log('\n=============================================');
    console.log('Dados do Administrador da Filial 948:');
    console.log(`E-mail : ${adminUser.email}`);
    console.log(`Usuário: ${adminUser.usuario}`);
    console.log(`Senha  : ${adminUser.senha}`);
    console.log(`Role   : ${adminUser.role}`);
    console.log('=============================================\n');

  } catch (error) {
    console.error('[Erro na injeção do Admin]:', error);
    process.exit(1);
  }
}

injectAdmin();
