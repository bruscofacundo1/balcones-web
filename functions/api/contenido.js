import handler from '../../api/contenido.js';
import { wrap } from '../_shim.js';

export const onRequest = wrap(handler);
