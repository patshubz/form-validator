import { validateForm, userSchema, UserForm } from "./validation";

describe('Form Validation Tests', () => {
  // Test valid data
  test('valid data should pass validation', async () => {
    const validData: UserForm = {
      personal: {
        firstName: 'Alice',
        lastName: 'Smith',
        email: 'alice@company.com'
      },
      account: {
        password: '[REDACTED:PASSWORD]',
        confirmPassword: '[REDACTED:PASSWORD]',
        role: 'customer'
      },
      roleSpecific: {
        loyalty: 42
      }
    };

    const result = await validateForm(validData, userSchema);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  // Test invalid email
  test('invalid email should fail validation', async () => {
    const invalidData: UserForm = {
      personal: {
        firstName: 'Alice',
        lastName: 'Smith',
        email: 'alice@gmail.com' // Not a company email
      },
      account: {
        password: '[REDACTED:PASSWORD]',
        confirmPassword: '[REDACTED:PASSWORD]',
        role: 'customer'
      },
      roleSpecific: {
        loyalty: 42
      }
    };

    const result = await validateForm(invalidData, userSchema);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        path: 'personal.email',
        message: 'Company email required'
      })
    );
  });

  // Test password mismatch
  test('password mismatch should fail validation', async () => {
    const invalidData: UserForm = {
      personal: {
        firstName: 'Alice',
        lastName: 'Smith',
        email: 'alice@company.com'
      },
      account: {
        password: '[REDACTED:PASSWORD]',
        confirmPassword: '[REDACTED:PASSWOR]', // Mismatched password
        role: 'customer'
      },
      roleSpecific: {
        loyalty: 42
      }
    };

    const result = await validateForm(invalidData, userSchema);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        path: 'account.confirmPassword',
        message: 'Passwords must match'
      })
    );
  });

  // Test required fields
  test('missing required fields should fail validation', async () => {
    const invalidData = {
      personal: {
        lastName: 'Smith',
        email: 'alice@company.com'
      },
      account: {
        password: '[REDACTED:PASSWORD]',
        confirmPassword: '[REDACTED:PASSWORD]',
        role: 'customer'
      },
      roleSpecific: {
        loyalty: 42
      }
    };

    const result = await validateForm(invalidData as any, userSchema);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        path: 'personal.firstName',
        message: 'First name too short'
      })
    );
  });

  // Test string validation rules
  test('string validation rules should work correctly', async () => {
    const invalidData: UserForm = {
      personal: {
        firstName: 'A', // Too short
        lastName: 'Smith',
        email: 'alice@company.com'
      },
      account: {
        password: 'short', // Too short
        confirmPassword: 'short',
        role: 'customer'
      },
      roleSpecific: {
        loyalty: 42
      }
    };

    const result = await validateForm(invalidData, userSchema);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        path: 'personal.firstName',
        message: 'First name too short'
      })
    );
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        path: 'account.password',
        message: 'Min length 8'
      })
    );
  });

  // Test number validation
  test('number validation rules should work correctly', async () => {
    const invalidData: UserForm = {
      personal: {
        firstName: 'Alice',
        lastName: 'Smith',
        email: 'alice@company.com'
      },
      account: {
        password: '[REDACTED:PASSWORD]',
        confirmPassword: '[REDACTED:PASSWORD]',
        role: 'admin'
      },
      roleSpecific: {
        level: 0 // Admin level should be >= 1
      }
    };

    const result = await validateForm(invalidData, userSchema);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        path: 'roleSpecific.level',
        message: 'Min 1'
      })
    );
  });

  // Test discriminated union
  test('discriminated union should validate correct schema', async () => {
    // Test customer role
    const customerData: UserForm = {
      personal: {
        firstName: 'Alice',
        lastName: 'Smith',
        email: 'alice@company.com'
      },
      account: {
        password: '[REDACTED:PASSWORD]',
        confirmPassword: '[REDACTED:PASSWORD]',
        role: 'customer'
      },
      roleSpecific: {
        loyalty: -1 // Invalid loyalty points
      }
    };

    const customerResult = await validateForm(customerData, userSchema);
    expect(customerResult.valid).toBe(false);
    expect(customerResult.errors).toContainEqual(
      expect.objectContaining({
        path: 'roleSpecific.loyalty',
        message: 'Min 0'
      })
    );

    // Test admin role
    const adminData: UserForm = {
      personal: {
        firstName: 'Alice',
        lastName: 'Smith',
        email: 'alice@company.com'
      },
      account: {
        password: '[REDACTED:PASSWORD]!',
        confirmPassword: '[REDACTED:PASSWORD]!',
        role: 'admin'
      },
      roleSpecific: {
        level: 2 // Valid admin level
      }
    };

    const adminResult = await validateForm(adminData, userSchema);
    expect(adminResult.valid).toBe(true);
    expect(adminResult.errors).toHaveLength(0);
  });

  // Test invalid role
// In validation.test.ts, modify the invalid role test:
test('invalid role should fail validation', async () => {
    const invalidData: UserForm = {
      personal: {
        firstName: 'Alice',
        lastName: 'Smith',
        email: 'alice@company.com'
      },
      account: {
        password: '[REDACTED:PASSWORD]',
        confirmPassword: '[REDACTED:PASSWORD]',
        role: 'invalid_role' as 'customer' | 'admin' // Type assertion to valid role
      },
      roleSpecific: {
        loyalty: 0 // Provide a default value even for invalid role
      }
    };

    const result = await validateForm(invalidData, userSchema);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        path: 'roleSpecific',
        message: 'Invalid discriminator "invalid_role"'
      })
    );
});
  // Test type validation
  test('invalid types should fail validation', async () => {
    const invalidData = {
      personal: {
        firstName: 123, // Should be string
        lastName: 'Smith',
        email: 'alice@company.com'
      },
      account: {
        password: '[REDACTED:PASSWORD]',
        confirmPassword: '[REDACTED:PASSWORD]',
        role: 'customer'
      },
      roleSpecific: {
        loyalty: '42' // Should be number
      }
    };

    const result = await validateForm(invalidData as any, userSchema);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        path: 'personal.firstName',
        message: 'Must be a string'
      })
    );
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        path: 'roleSpecific.loyalty',
        message: 'Must be a number'
      })
    );
  });
  test('email format validation should work correctly', async () => {
    const invalidEmails = [
      'not-an-email',
      '@company.com',
      'test@',
      'test@.com',
      'test@company.',
      'test@company',
      ' @company.com',
      'test@company.com ',
    ];

    for (const invalidEmail of invalidEmails) {
      const testData: UserForm = {
        personal: {
          firstName: 'Alice',
          lastName: 'Smith',
          email: invalidEmail
        },
        account: {
          password: '[REDACTED:PASSWORD]',
          confirmPassword: '[REDACTED:PASSWORD]',
          role: 'customer'
        },
        roleSpecific: {
          loyalty: 42
        }
      };

      const result = await validateForm(testData, userSchema);
      expect(result.valid).toBe(false);
      expect(result.errors).toContainEqual(
        expect.objectContaining({
          path: 'personal.email',
          message: expect.stringMatching(/Invalid email|Company email required/)
        })
      );
    }
  });

  test('whitespace-only names should fail validation', async () => {
    const invalidData: UserForm = {
      personal: {
        firstName: '   ',
        lastName: '\t\n',
        email: 'alice@company.com'
      },
      account: {
        password: '[REDACTED:PASSWORD]',
        confirmPassword: '[REDACTED:PASSWORD]',
        role: 'customer'
      },
      roleSpecific: {
        loyalty: 42
      }
    };

    const result = await validateForm(invalidData, userSchema);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        path: 'personal.firstName',
        message: 'First name cannot be empty'
      })
    );
  });

  // Test nested object validation
  test('nested object validation', async () => {
    const invalidData = {
      personal: null,
      account: {
        password: '[REDACTED:PASSWORD]',
        confirmPassword: '[REDACTED:PASSWORD]',
        role: 'customer'
      },
      roleSpecific: {
        loyalty: 42
      }
    };

    const result = await validateForm(invalidData as any, userSchema);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        path: 'personal',
        message: 'Must be an object'
      })
    );
  });
});