import { z } from 'zod';

// Mensagens de validação em português do Brasil para as regras sem mensagem própria. Sem isto,
// quem chamasse a API com um dado de tipo errado recebia "Invalid input: expected string,
// received number". Importe o z daqui, e não de 'zod', para valer em todo lugar.
z.config(z.locales.ptBR());

export { z };
