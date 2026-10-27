import { View } from "react-native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { RootParams } from "../../navigation/types";
import { AppText } from "../../ui/AppText";
import { Banner } from "../../ui/States";
import { Screen } from "../../ui/Screen";

const DOCS: Record<string, { title: string; items: [string, string][] }> = {
  termos: {
    title: "Termos de Uso",
    items: [
      ["Quem pode usar", "O Ilove é exclusivo para pessoas com 18 anos ou mais. Contas de menores são removidas."],
      ["O que é o Ilove", "Uma vitrine para prestadoras independentes apresentarem serviços lícitos e para clientes solicitarem agendamentos. O Ilove não processa pagamentos nem é parte do atendimento combinado."],
      ["Conduta", "É proibido qualquer conteúdo ilegal, sem consentimento, que envolva menores, coerção, exploração, golpes ou assédio. Denúncias são analisadas e perfis podem ser desativados."],
      ["Responsabilidade", "Prestadoras respondem pelas informações e fotos que publicam e declaram ter direito de usá-las. Valores, local e condições são combinados entre as partes."],
      ["Texto de exemplo", "Este é um texto de partida do MVP e deve ser revisado por um profissional jurídico antes de qualquer lançamento."],
    ],
  },
  privacidade: {
    title: "Política de Privacidade",
    items: [
      ["Dados coletados", "E-mail, data de nascimento (apenas para conferir a idade), dados do perfil, fotos enviadas e mensagens."],
      ["Uso", "Para operar a conta, exibir perfis publicados, permitir agendamentos e moderar denúncias."],
      ["Seus direitos", "Você pode editar seus dados, solicitar a exclusão da conta e bloquear usuários. Em Perfil → Configurações há o pedido de exclusão."],
      ["Texto de exemplo", "Texto de partida do MVP (LGPD): revise com um profissional antes de lançar."],
    ],
  },
  seguranca: {
    title: "Dicas de segurança",
    items: [
      ["Combine com clareza", "Confirme valor, horário, local e duração antes do atendimento."],
      ["Não pague adiantado a desconhecidos", "O Ilove não processa pagamentos. Desconfie de pedidos de pagamento antecipado."],
      ["Local seguro", "Prefira locais públicos no primeiro encontro e avise alguém de confiança."],
      ["Denuncie", "Use Denunciar no perfil ou na conversa. Menores de idade, coerção e conteúdo sem consentimento têm prioridade."],
    ],
  },
};

export function LegalScreen({ route }: NativeStackScreenProps<RootParams, "Legal">) {
  const d = DOCS[route.params.doc];
  return (
    <Screen>
      <View style={{ paddingTop: 16, gap: 14 }}>
        <AppText variant="title" accessibilityRole="header">{d.title}</AppText>
        {d.items.map(([h, t]) => (
          <View key={h} style={{ gap: 4 }}>
            <AppText variant="heading">{h}</AppText>
            <AppText muted>{t}</AppText>
          </View>
        ))}
        <Banner tone="warn">Conteúdo de modelo, sem validade jurídica própria.</Banner>
      </View>
    </Screen>
  );
}
