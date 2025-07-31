// 1. Base Types & Field Schemas
export type PrimitiveType = 'string' | 'number' | 'boolean';
export type FieldFormat = 'date' | 'email' | 'url';

// Helper type for validate function
export type ValidateFunction<T> = (value: T, allValues: any) => string | null | Promise<string | null>;

// Validation rule fragments
export type StringValidationRules = {
  minLength?: number;
  maxLength?: number;
  pattern?: RegExp;
  email?: boolean;
  url?: boolean;
  contains?: string;
  startsWith?: string;
  endsWith?: string;
  format?: FieldFormat;
};

export type NumberValidationRules = {
  min?: number;
  max?: number;
  integer?: boolean;
  positive?: boolean;
  negative?: boolean;
  multipleOf?: number;
};

export type ArrayValidationRules = {
  minItems?: number;
  maxItems?: number;
  uniqueItems?: boolean;
};

// Base schema interface
export interface BaseFieldSchema<T extends PrimitiveType | 'array' | 'object' | 'discriminatedUnion' | 'asyncValidator', V> {
  type: T;
  required?: boolean;
  nullable?: boolean;
  errorMessage?: string | ((value: V) => string);
  validate?: ValidateFunction<V>;
}

// Concrete field schemas
export interface StringFieldSchema extends BaseFieldSchema<'string', string>, StringValidationRules {}
export interface NumberFieldSchema extends BaseFieldSchema<'number', number>, NumberValidationRules {}
export interface BooleanFieldSchema extends BaseFieldSchema<'boolean', boolean> {}

export interface ArrayFieldSchema<T> extends BaseFieldSchema<'array', T[]>, ArrayValidationRules {
  items: SchemaDefinition;
}

export interface ObjectFieldSchema<Props extends Record<string, any>> extends BaseFieldSchema<'object', Props> {
  properties: { [K in keyof Props]: SchemaDefinition };
}

export interface DiscriminatedUnionFieldSchema extends BaseFieldSchema<'discriminatedUnion', any> {
  discriminator: string;
  schemas: { [key: string]: SchemaDefinition };
}

export interface AsyncValidatorSchema extends BaseFieldSchema<'asyncValidator', any> {
  dependsOn: string;
}

// Union of all schema definitions
export type SchemaDefinition =
  | StringFieldSchema
  | NumberFieldSchema
  | BooleanFieldSchema
  | ArrayFieldSchema<any>
  | ObjectFieldSchema<any>
  | DiscriminatedUnionFieldSchema
  | AsyncValidatorSchema;

export type FormSchema = Record<string, SchemaDefinition>;

/** Infer the TypeScript data shape from a single SchemaDefinition */
export type InferSchemaType<D> =
  D extends StringFieldSchema ? (D['required'] extends true ? string : string | undefined) :
  D extends NumberFieldSchema ? (D['required'] extends true ? number : number | undefined) :
  D extends BooleanFieldSchema ? (D['required'] extends true ? boolean : boolean | undefined) :
  D extends ArrayFieldSchema<infer U> ? (D['required'] extends true ? Array<InferSchemaType<D['items']>> : Array<InferSchemaType<D['items']>> | undefined) :
  D extends ObjectFieldSchema<infer P> ? (D['required'] extends true ? { [K in keyof P]: InferSchemaType<P[K]> } : { [K in keyof P]: InferSchemaType<P[K]> } | undefined) :
  D extends DiscriminatedUnionFieldSchema ? (
    D['required'] extends true
      ? { [K in keyof D['schemas']]: InferSchemaType<D['schemas'][K]> }[keyof D['schemas']]
      : { [K in keyof D['schemas']]: InferSchemaType<D['schemas'][K]> }[keyof D['schemas']] | undefined
  ) :
  unknown;

/** Full form data type inferred from a FormSchema */
export type FormData<S extends FormSchema> = {
  [K in keyof S]: InferSchemaType<S[K]>;
};

/** Generate all valid dot‑paths and array‑paths into a nested data type */
export type PathsToStringProps<T> = T extends object
  ? { [K in keyof T & string]:
      T[K] extends (infer U)[]
        ? K | `${K}[${number}]` | `${K}[${number}].${PathsToStringProps<U>}`
        : T[K] extends object
          ? K | `${K}.${PathsToStringProps<T[K]>}`
          : K
    }[keyof T & string]
  : never;

export interface ValidationError<T> {
  path: PathsToStringProps<T>;
  message: string;
}

export interface ValidationResult<T> {
  valid: boolean;
  errors: ValidationError<T>[];
  asyncErrors?: ValidationError<T>[];
}

// Part 2: validation.ts (continued)

export async function validateForm<S extends FormSchema>(
  data: FormData<S>,
  schema: S
): Promise<ValidationResult<FormData<S>>> {
  const errors: ValidationError<FormData<S>>[] = [];
  const asyncErrors: ValidationError<FormData<S>>[] = [];

  function addError(path: string, message: string) {
    errors.push({ path: path as any, message });
  }

  function addAsyncError(path: string, message: string) {
    asyncErrors.push({ path: path as any, message });
  }

  async function validateValue(value: unknown, def: SchemaDefinition, path: string, allValues: any): Promise<void> {
    if (def.required && (value === undefined || value === null)) {
      addError(path, typeof def.errorMessage === 'string' ? def.errorMessage : 'Field is required');
      return;
    }
    if (value === undefined && !def.required) return;

    switch (def.type) {
      case 'string': validateString(value, def as StringFieldSchema, path); break;
      case 'number': validateNumber(value, def as NumberFieldSchema, path); break;
      case 'boolean': 
        if (typeof value !== 'boolean') addError(path, 'Must be a boolean'); 
        break;
      case 'array': await validateArray(value, def as ArrayFieldSchema<any>, path, allValues); break;
      case 'object': await validateObject(value, def as ObjectFieldSchema<any>, path, allValues); break;
      case 'discriminatedUnion': await validateDiscriminatedUnion(value, def as DiscriminatedUnionFieldSchema, path, allValues); break;
      case 'asyncValidator': await validateAsync(value, def as AsyncValidatorSchema, path, allValues); break;
    }

    if (def.validate) {
      try {
        const validate = def.validate as ValidateFunction<unknown>;
        const res = await validate(value, allValues);
        if (res) addError(path, res);
      } catch (err) {
        addError(path, err instanceof Error ? err.message : 'Validation error');
      }
    }
  }

  function validateString(v: unknown, sch: StringFieldSchema, path: string) {
    if (typeof v !== 'string') { addError(path, 'Must be a string'); return; }
    if (sch.minLength !== undefined && v.length < sch.minLength)
      addError(path, sch.errorMessage?.toString() || `Min length ${sch.minLength}`);
    if (sch.maxLength !== undefined && v.length > sch.maxLength)
      addError(path, sch.errorMessage?.toString() || `Max length ${sch.maxLength}`);
    if (sch.pattern && !sch.pattern.test(v))
      addError(path, sch.errorMessage?.toString() || `Invalid format`);
    if (sch.email && !/[^\s@]+@[^\s@]+\.[^\s@]+/.test(v))
      addError(path, sch.errorMessage?.toString() || `Invalid email`);
    if (sch.url && !/https?:\/\/\S+/.test(v))
      addError(path, sch.errorMessage?.toString() || `Invalid URL`);
    if (sch.contains && !v.includes(sch.contains))
      addError(path, sch.errorMessage?.toString() || `Must contain "${sch.contains}"`);
    if (sch.startsWith && !v.startsWith(sch.startsWith))
      addError(path, sch.errorMessage?.toString() || `Must start with "${sch.startsWith}"`);
    if (sch.endsWith && !v.endsWith(sch.endsWith))
      addError(path, sch.errorMessage?.toString() || `Must end with "${sch.endsWith}"`);
    if (sch.format === 'date' && isNaN(Date.parse(v)))
      addError(path, sch.errorMessage?.toString() || `Invalid date`);
  }

  function validateNumber(v: unknown, sch: NumberFieldSchema, path: string) {
    if (typeof v !== 'number' || isNaN(v)) { addError(path, 'Must be a number'); return; }
    if (sch.min !== undefined && v < sch.min) addError(path, `Min ${sch.min}`);
    if (sch.max !== undefined && v > sch.max) addError(path, `Max ${sch.max}`);
    if (sch.integer && !Number.isInteger(v)) addError(path, `Must be integer`);
    if (sch.positive && v <= 0) addError(path, `Must be positive`);
    if (sch.negative && v >= 0) addError(path, `Must be negative`);
    if (sch.multipleOf !== undefined && v % sch.multipleOf !== 0)
      addError(path, `Must be multiple of ${sch.multipleOf}`);
  }

  async function validateArray(v: unknown, sch: ArrayFieldSchema<any>, path: string, allValues: any) {
    if (!Array.isArray(v)) { addError(path, 'Must be an array'); return; }
    if (sch.minItems !== undefined && v.length < sch.minItems) addError(path, `Min items ${sch.minItems}`);
    if (sch.maxItems !== undefined && v.length > sch.maxItems) addError(path, `Max items ${sch.maxItems}`);
    if (sch.uniqueItems) {
      const set = new Set(v.map(i => JSON.stringify(i)));
      if (set.size !== v.length) addError(path, `Items must be unique`);
    }
    for (let i = 0; i < v.length; i++) {
      await validateValue(v[i], sch.items, `${path}[${i}]`, allValues);
    }
  }

  async function validateObject(v: unknown, sch: ObjectFieldSchema<any>, path: string, allValues: any) {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) {
      addError(path, 'Must be an object');
      return;
    }
    for (const key of Object.keys(sch.properties)) {
      await validateValue((v as any)[key], sch.properties[key], path ? `${path}.${key}` : key, allValues);
    }
  }

  async function validateDiscriminatedUnion(v: unknown, sch: DiscriminatedUnionFieldSchema, path: string, allValues: any) {
    const parts = sch.discriminator.split('.');
    let dv: any = allValues;
    for (const p of parts) { dv = dv?.[p]; }
    const sub = sch.schemas[dv];
    if (!sub) { addError(path, `Invalid discriminator "${dv}"`); return; }
    await validateValue(v, sub, path, allValues);
  }

  async function validateAsync(v: unknown, sch: AsyncValidatorSchema, path: string, allValues: any) {
    if (sch.validate) {
      const res = await sch.validate(v, allValues);
      if (res) addAsyncError(path, res);
    }
  }

  await validateValue(data, { type: 'object', properties: schema }, '', data);

  return {
    valid: errors.length === 0 && asyncErrors.length === 0,
    errors,
    asyncErrors: asyncErrors.length > 0 ? asyncErrors : undefined
  };
}

// Example schema
export const userSchema = {
  personal: {
    type: 'object' as const,
    properties: {
      firstName: { 
        type: 'string' as const, 
        required: true, 
        minLength: 2, 
        errorMessage: 'First name too short',
        validate: (value: string) => value.trim() ? null : 'First name cannot be empty'
      },
      lastName: { 
        type: 'string' as const, 
        required: true, 
        minLength: 2 
      },
      email: { 
        type: 'string' as const, 
        required: true, 
        email: true, 
        validate: (value: string) => value.endsWith('@company.com') ? null : 'Company email required'
      },
    }
  },
  account: {
    type: 'object' as const,
    properties: {
      password: { type: 'string' as const, required: true, minLength: 8 },
      confirmPassword: { 
        type: 'string' as const, 
        required: true, 
        validate: (v: string, all: any) => v === all.account.password ? null : 'Passwords must match'
      },
      role: { type: 'string' as const, required: true },
    }
  },
  roleSpecific: {
    type: 'discriminatedUnion' as const,
    discriminator: 'account.role',
    schemas: {
      customer: { 
        type: 'object' as const, 
        properties: { 
          loyalty: { type: 'number' as const, min: 0 } 
        } 
      },
      admin: { 
        type: 'object' as const, 
        properties: { 
          level: { type: 'number' as const, min: 1 } 
        } 
      }
    }
  }
} as const;

export type UserForm = FormData<typeof userSchema>;
export type CustomerForm = UserForm & {
  account: { role: 'customer' };
  roleSpecific: { loyalty: number };
};
export type AdminForm = UserForm & {
  account: { role: 'admin' };
  roleSpecific: { level: number };
};