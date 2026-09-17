import type { Metadata } from "next";
import LegalPage from "../legal-page";

export const metadata: Metadata = { title: "Política de Privacidade — Estúdio Fluxo" };

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Política de Privacidade"
      intro="Esta política explica quais dados o Estúdio Fluxo utiliza, por que eles são necessários e quais escolhas você possui ao usar o serviço."
      sections={[
        {
          title: "Dados utilizados",
          items: [
            "Dados de conta: e-mail, identificador de usuário e informações básicas de perfil fornecidas pelo Google, quando esse método de entrada for escolhido.",
            "Dados técnicos essenciais: sessão de autenticação, registros de segurança e informações necessárias para operar e proteger o serviço.",
            "Dados do painel: projetos e informações financeiras permanecem no armazenamento local do navegador neste estágio do produto.",
          ],
        },
        {
          title: "Finalidades",
          paragraphs: [
            "Usamos os dados para criar e proteger sua conta, manter sua sessão, oferecer recuperação de acesso, prevenir abuso e prestar suporte.",
            "O login com Google solicita apenas as informações básicas necessárias para identificar a conta. Não acessamos Gmail, Drive, agenda ou contatos.",
          ],
        },
        {
          title: "Serviços envolvidos",
          paragraphs: [
            "Supabase processa autenticação e dados de conta; Google processa o login quando escolhido; Netlify hospeda o aplicativo. Esses fornecedores tratam dados conforme seus próprios termos e políticas de privacidade.",
          ],
        },
        {
          title: "Compartilhamento e venda",
          paragraphs: [
            "Não vendemos dados pessoais. Dados são compartilhados apenas com os fornecedores necessários à operação, por obrigação legal ou para proteger direitos e segurança.",
          ],
        },
        {
          title: "Retenção e segurança",
          paragraphs: [
            "Mantemos dados de conta enquanto ela estiver ativa ou pelo período necessário às finalidades descritas. Aplicamos HTTPS, autenticação gerenciada e controles de acesso. Nenhum sistema elimina todos os riscos; por isso, use senha exclusiva e proteja seu dispositivo.",
          ],
        },
        {
          title: "Seus direitos",
          paragraphs: [
            "Você pode solicitar acesso, correção ou exclusão dos seus dados de conta e retirar o vínculo com Google. Envie a solicitação para oericfrantto@gmail.com. Também é possível remover o acesso nas configurações da sua Conta Google.",
          ],
        },
        {
          title: "Alterações e contato",
          paragraphs: [
            "Podemos atualizar esta política para refletir mudanças no serviço ou na legislação. A versão vigente ficará disponível nesta página. Dúvidas e solicitações: oericfrantto@gmail.com.",
          ],
        },
      ]}
    />
  );
}
