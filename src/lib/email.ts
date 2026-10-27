import nodemailer from 'nodemailer';

// Envio de email por SMTP, para não amarrar o projeto a um serviço: funciona com uma conta
// Gmail (senha de app) ou com o Brevo, ambos gratuitos e sem domínio próprio.
// Variáveis: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS e EMAIL_REMETENTE.
export const emailConfigurado = () =>
    Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

export async function enviarEmail({ para, assunto, texto, html }: { para: string; assunto: string; texto: string; html: string }) {
    const porta = Number(process.env.SMTP_PORT ?? 587);
    const transporte = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: porta,
        secure: porta === 465,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    await transporte.sendMail({
        from: process.env.EMAIL_REMETENTE || process.env.SMTP_USER,
        to: para,
        subject: assunto,
        text: texto,
        html,
    });
}
