import handler from '../../../api/admin/contenido.js';
import { wrap } from '../../_shim.js';

export const onRequest = wrap(handler);
