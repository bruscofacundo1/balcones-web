import handler from '../../api/webhook-mercadopago.js';
import { wrap } from '../_shim.js';

export const onRequest = wrap(handler);
