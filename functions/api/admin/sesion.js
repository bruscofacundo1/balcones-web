import handler from '../../../api/admin/sesion.js';
import { wrap } from '../../_shim.js';

export const onRequest = wrap(handler);
