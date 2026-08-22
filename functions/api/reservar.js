import handler from '../../api/reservar.js';
import { wrap } from '../_shim.js';

export const onRequest = wrap(handler);
