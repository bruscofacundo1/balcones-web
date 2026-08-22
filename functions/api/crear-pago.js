import handler from '../../api/crear-pago.js';
import { wrap } from '../_shim.js';

export const onRequest = wrap(handler);
