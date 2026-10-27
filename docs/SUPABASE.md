# Configurando o Supabase (tudo pelo navegador)

> Sem credenciais o app continua em **modo demonstração**. Siga estes passos quando quiser o backend real.

## 1. Criar o projeto
1. Acesse <https://supabase.com> → **New project**. Escolha um nome, uma **senha forte do banco** (guarde-a) e a região mais próxima (ex.: South America – São Paulo).
2. Aguarde o projeto ficar pronto.

## 2. Criar tabelas, regras e storage
No menu lateral abra **SQL Editor → New query** e, **nesta ordem**, cole o conteúdo de cada arquivo e clique **Run**:

1. `supabase/01_schema.sql` — tabelas, gatilhos (idade ≥ 18, máquina de estados dos agendamentos, publicação, avaliações) e funções.
2. `supabase/02_policies.sql` — **RLS** (tudo bloqueado por padrão; políticas mínimas por tabela).
3. `supabase/03_storage.sql` — bucket `profile-media` (público para leitura, 5 MB, JPG/PNG/WebP, escrita só na própria pasta).
4. `supabase/04_seed.sql` — categorias e referências de preço **demonstrativas**.
5. *(opcional)* `supabase/05_demo_data.sql` — 8 perfis fictícios para a vitrine não ficar vazia. Para remover depois:
   `delete from auth.users where email like '%@demo.ilove.local';`

Se algum arquivo der erro, copie a mensagem completa e me envie.

## 3. Configurar login (Authentication)
- **Authentication → Providers → Email**: deixe habilitado.
- **Confirm email**: ligado é o recomendado (o app mostra "confirme seu e-mail"). Para testar mais rápido você pode desligar temporariamente.
- Recuperação de senha: o e-mail enviado leva a um link do Supabase; **o app não trata esse link** (Snack/Expo Go sem deep link configurado). Para o MVP, defina a nova senha pelo painel (**Authentication → Users**) ou configure o redirecionamento depois.

## 4. Colocar a URL e a chave no app
1. **Project Settings → API**. Copie **Project URL** e a chave **anon / publishable**.
2. Em `src/config.ts` preencha `SUPABASE_URL` e `SUPABASE_ANON_KEY`.
3. **NUNCA** use a chave `service_role` ou `secret`. O app recusa essas chaves e avisa na tela inicial.

## 5. Criar um administrador
O app **não** cria admins. Cadastre-se normalmente no app com o seu e-mail e então, no SQL Editor:
```sql
insert into public.user_roles(user_id, role)
select id, 'admin' from auth.users where email = 'seu@email.com';
```
Para suspender uma conta: o mesmo comando com `role = 'suspended'`.

## 6. Roteiro de teste
1. Cadastre uma conta **menor de 18** (data de nascimento recente) → deve ser recusada.
2. Cadastre uma conta de **prestadora** → Publicar → dados do perfil, foto, serviço, disponibilidade → publicar.
3. Cadastre uma conta de **cliente** (outro e-mail) → veja o perfil, favorite, solicite agendamento.
4. Na conta da prestadora: aceite; marque como concluído **depois do horário**; na conta do cliente: avalie.
5. Mensagens, denúncia e bloqueio. Como admin: Perfil → Moderação.

## Segurança — o que está e o que não está garantido
- RLS ligado em todas as tabelas; regras críticas também em **gatilhos** (o app só decide o que mostrar).
- A idade é **autodeclarada** (data de nascimento) e validada no banco; **não há verificação de documento**. Isso precisa ser avaliado antes de qualquer lançamento real.
- Fotos publicadas ficam em bucket **público** (qualquer pessoa com a URL vê). Não há moderação automática de imagens.
- Dados de demonstração são marcados `is_demo` e exibem o selo "Demonstração".
- Aviso: validei o SQL em um Postgres local com dublês de `auth`/`storage`. **Não testei em um projeto Supabase real.** Rode o roteiro acima e me informe qualquer divergência.
