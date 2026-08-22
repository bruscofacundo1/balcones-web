import handler from '../../../api/admin/fotos.js';
import { wrap } from '../../_shim.js';

export const onRequest = wrap(handler);
