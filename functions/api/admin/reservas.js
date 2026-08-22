import handler from '../../../api/admin/reservas.js';
import { wrap } from '../../_shim.js';

export const onRequest = wrap(handler);
