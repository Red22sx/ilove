# Status do Ilove Mobile

Legenda: ✅ feito e verificado como descrito · 🟡 feito, mas **não verificado em celular/Snack/Supabase real** · ⏳ pendente

## Funcionalidades
| Área | Item | Status |
|---|---|---|
| Entrada | Boas-vindas com confirmação 18+, login, cadastro (data de nascimento ≥ 18), recuperação, termos/privacidade/segurança | ✅ (demo, navegador) · 🟡 Supabase |
| Navegação | Abas Início, Buscar, Publicar (+), Mensagens, Perfil; pilhas de telas | ✅ (navegador) · 🟡 celular |
| Início | Trilhas: destaque, populares, online, novidades; categorias; favoritar | ✅ |
| Feed | Vertical em tela cheia, paginado, favoritar, abrir perfil | ✅ (navegador) · 🟡 gesto de rolagem no celular |
| Busca | Texto sem acento, cidade, modalidade, categoria, preço, dia, 6 ordenações | ✅ |
| Perfil público | Galeria, serviços, disponibilidade, avaliações, favoritar, denunciar, bloquear, mensagem | ✅ |
| Agendamento | Escolha de serviço/dia/horário livre, solicitação, aceitar/recusar/cancelar/concluir/disputar, conflito de horário | ✅ (regras testadas) |
| Avaliações | Somente cliente, atendimento concluído, uma por agendamento | ✅ |
| Favoritos, notificações | Lista, marcação de lidas | ✅ |
| Mensagens | Conversas, envio, não lidas, denunciar/bloquear (atualiza a cada 4 s; sem tempo real) | ✅ |
| Prestadora | Dados do perfil, publicar/despublicar com requisitos, serviços e preços em centavos, assistente de preço, disponibilidade | ✅ |
| Fotos | Escolher da galeria, pré-visualizar, principal, várias (até 12), substituir, excluir, reordenar (botões), validação JPG/PNG/WebP ≤ 5 MB | ✅ demo · 🟡 galeria real e Storage |
| Progresso de envio | Etapas (lendo → enviando → salvando), **não** porcentagem real de bytes | 🟡 |
| Aparência | Claro / Escuro / Dispositivo, salvo no aparelho (AsyncStorage) | ✅ |
| Admin básico | Denúncias, desativar perfil, log de auditoria | ✅ demo · 🟡 Supabase |
| Responsividade | `useWindowDimensions`, safe areas, teclado, fonte ampliada limitada; testado 360–430 e 768 px | ✅ navegador · 🟡 celular real |
| Supabase | Schema, RLS, storage, gatilhos, seed; testes locais no PGlite | ✅ local · 🟡 **projeto real não testado** |

## Limitações conhecidas
- **Não testei no Expo Go/Snack nem em celular.** A verificação visual foi em navegador (react-native-web).
- **Versão do SDK:** o projeto foi alinhado ao Expo SDK 54 para compatibilidade com o seletor atual do Snack; resta a validação visual no Snack autenticado.
- **Supabase real:** nunca executado por mim; credenciais não foram fornecidas.
- **Upload no Supabase:** a leitura do arquivo escolhido usa `fetch(uri).arrayBuffer()`, comum no React Native, mas não foi exercitada num aparelho.
- **Progresso de upload** é por etapas: o `supabase-js` não expõe progresso de bytes.
- **Reordenar fotos** por botões (não por arrastar).
- **Recuperação de senha:** o link do e-mail não é tratado dentro do app (sem deep link no Snack).
- **Mensagens** sem tempo real (consulta periódica).
- **Visualizações:** só usuários logados contam (visitantes anônimos não).
- **Disponibilidade vs. fuso:** horários são "relógio local"; o banco não confere a disponibilidade, apenas conflitos de horário aceitos.
- **Idade autodeclarada**, sem verificação de documentos. **Sem moderação automática** de imagens. **Sem pagamentos** (por regra do projeto).
- **Fotos de demonstração** são ilustrações abstratas, não pessoas. Preços de referência são demonstrativos.
- **Notificações push** não existem (apenas lista dentro do app).
- Textos legais são **modelos** e precisam de revisão jurídica.
- **Exclusão de conta:** registra o pedido; a remoção efetiva é manual (painel do Supabase).

## Ideias para a próxima etapa
Deep link de recuperação de senha, tempo real nas mensagens (Supabase Realtime), arrastar para reordenar fotos, verificação de identidade/idade por provedor, moderação de imagens, push, painel admin mais completo.
