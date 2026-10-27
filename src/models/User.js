import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
    nome: {
        type: String,
        required: [true, 'Por favor, informe seu nome.'],
    },
    email: {
        type: String,
        required: [true, 'Por favor, informe um email.'],
        unique: true,
    },
    senha: {
        type: String,
        required: [true, 'Por favor, informe uma senha.'],
    },
    // Quando a pessoa aceitou o aviso de privacidade no cadastro (página /privacidade)
    aceitouPrivacidadeEm: { type: Date, default: null },
    // Recuperação de senha por email: só o hash do código vai para o banco, nunca o código
    resetSenhaHash: { type: String, default: null },
    resetSenhaExpira: { type: Date, default: null },
}, {
    timestamps: true,
});

export default mongoose.models.User || mongoose.model('User', UserSchema);
