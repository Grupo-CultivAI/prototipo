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
}, {
    timestamps: true,
});

export default mongoose.models.User || mongoose.model('User', UserSchema);
