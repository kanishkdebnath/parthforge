import { z } from 'zod';

export const ObjectIdString = z
  .string()
  .regex(/^[a-f\d]{24}$/i, 'Invalid id');
