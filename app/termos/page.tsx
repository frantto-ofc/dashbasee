import type { Metadata } from "next";
import LegalPage from "../legal-page";

export const metadata: Metadata = { title: "Termos de Serviço — Estúdio Fluxo" };

export default function TermsPage() {
  return (
    <LegalPage
      title="Termos de Serviço"
      intro="Ao criar uma conta ou usar o Estúdio Fluxo, você concorda com estes termos. Se não concordar, não use o serviço."
      sections={[
        {
          title: "Uso do serviço",
          paragraphs: [
            "O Estúdio Fluxo oferece ferramentas de organização de projetos e finanças para uso profissional. Você deve fornecer informações corretas, proteger suas credenciais e responder pelas atividades realizadas em sua conta.",
          ],
        },
        {
          title: "Uso permitido",
          items: [
            "Não tentar acessar contas, sistemas ou dados de terceiros.",
            "Não explorar falhas, interferir no serviço ou contornar controles de segurança.",
            "Não usar o serviço para conteúdo ilegal, fraude ou violação de direitos.",
          ],
        },
        {
          title: "Dados e cópias de segurança",
          paragraphs: [
            "Neste estágio, os dados operacionais do painel ficam no navegador usado pelo usuário. Limpar os dados do navegador ou perder o dispositivo pode eliminar essas informações. Use o recurso de exportação para manter cópias de segurança.",
          ],
        },
        {
          title: "Disponibilidade e mudanças",
          paragraphs: [
            "Podemos corrigir, atualizar ou interromper recursos para manter a segurança e a operação. Comunicaremos mudanças relevantes quando isso for viável.",
          ],
        },
        {
          title: "Responsabilidade",
          paragraphs: [
            "O serviço auxilia a organização do trabalho e não substitui orientação contábil, jurídica ou financeira. Você responde pelas decisões tomadas com base nas informações inseridas no painel.",
          ],
        },
        {
          title: "Suspensão e encerramento",
          paragraphs: [
            "Podemos suspender acesso em caso de abuso, risco de segurança ou violação destes termos. Você pode solicitar o encerramento da conta pelo e-mail oericfrantto@gmail.com.",
          ],
        },
        {
          title: "Contato",
          paragraphs: [
            "Para dúvidas sobre estes termos, suporte ou solicitações relacionadas à conta, escreva para oericfrantto@gmail.com.",
          ],
        },
      ]}
    />
  );
}
