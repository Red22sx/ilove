# Ilove Mobile (MVP)

App Expo / React Native para um marketplace **exclusivo para maiores de 18 anos**: perfis de prestadoras, busca, feed vertical, agendamentos por solicitação, favoritos, avaliações, mensagens, denúncias/bloqueio e moderação básica. **Sem pagamentos.**

Funciona em dois modos:

| Modo | Quando | O que acontece |
|---|---|---|
| **Demonstração** | `src/config.ts` com `SUPABASE_URL` e `SUPABASE_ANON_KEY` vazios | Tudo roda no aparelho, com dados **fictícios** salvos no AsyncStorage. Nada precisa ser configurado. |
| **Supabase** | `src/config.ts` preenchido com a URL e a chave **anon** do seu projeto | Login, banco, regras (RLS) e fotos no Storage reais. Veja `docs/SUPABASE.md`. |

> O app **não** finge estar conectado: sem credenciais ele avisa que está em modo demonstração.

## Rodando no Expo Snack (sem instalar nada)

1. **Gere a pasta pronta para o Snack.** Ela já vem no zip em `snack-ready/` (sem testes e sem arquivos de desenvolvimento).
2. **Opção A — importar do GitHub (recomendada):**
   1. No navegador, crie um repositório novo no GitHub e envie (upload) o **conteúdo** de `snack-ready/` (`App.tsx`, `app.json`, `package.json`, pasta `src/`).
   2. Em <https://snack.expo.dev>, use a opção de importar repositório Git e cole a URL do repositório.
3. **Opção B — arrastar arquivos:** em um Snack novo, crie os arquivos/pastas com os mesmos caminhos (ex.: `src/ui/Button.tsx`) e cole o conteúdo. Só é prático para poucos arquivos.
4. **Escolha a versão do SDK.** O `package.json` usa o **Expo SDK 58** (`expo ~58.0.x`, React Native 0.88). No Snack, abra as configurações do projeto / seletor de SDK e escolha **a mesma versão**. Se o Snack ainda não oferecer o SDK 58, me diga qual SDK ele oferece: as versões do `package.json` precisam ser trocadas por ela (não consegui verificar isso daqui).
5. **No celular:** instale o app **Expo Go**, toque em "My Device"/escaneie o QR code do Snack. No navegador, a aba "Web" do Snack também funciona (visual aproximado; câmera, galeria e vibração se comportam diferente).
6. Na tela inicial confirme "Declaro ter 18 anos" e use **Entrar como cliente / prestadora / admin (demo)**.

### Contas de demonstração (só no modo demonstração)
`cliente.demo@ilove.local`, `prestadora.demo@ilove.local`, `admin.demo@ilove.local` — senha `Demo12345!`.

## Estrutura

```
App.tsx                      providers (query, tema, toast, navegação)
src/config.ts                URL + chave anon do Supabase (vazio = demonstração)
src/data/types.ts            tipos de domínio e contrato Repo
src/data/demoRepo.ts         implementação local (AsyncStorage)
src/data/supabaseRepo.ts     implementação Supabase (só chave anon)
src/logic/                   regras puras: dinheiro (centavos), idade, agendamento, horários, preço, validação
src/theme/                   tokens claro/escuro (contraste WCAG AA testado), ThemeProvider
src/ui/ src/components/      componentes
src/screens/                 auth, main, provider
supabase/01..05_*.sql        banco, RLS, storage, seed, dados demo opcionais
supabase/test/run.ts         testes do SQL num Postgres local (PGlite)
docs/                        SUPABASE.md, STATUS.md
```

## Qualidade verificada (nesta entrega)

- `npm run typecheck` (TypeScript estrito) — sem erros
- `npm test` — 83 testes (regras de negócio, contraste de cores, camada de dados demo, mapeamentos Supabase)
- `npm run db:test` — 35 testes do SQL/RLS num Postgres local (PGlite)
- App exportado para web e percorrido em navegador simulando celular (360–430 px e 768 px, claro/escuro)

**Não verificado por mim:** execução no Expo Go/Snack e em celular real; o Supabase de verdade (não recebi credenciais). Detalhes em `docs/STATUS.md`.
