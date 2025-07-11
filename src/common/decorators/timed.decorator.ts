import { Logger } from '@nestjs/common';

export function Timed(): MethodDecorator {
  const logger = new Logger('ExecutionTime');

  return (
    target: unknown,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) => {
    const originalMethod = descriptor.value as (
      ...args: unknown[]
    ) => Promise<unknown>;
    descriptor.value = async function (...args: unknown[]) {
      const label = `${String(propertyKey)} execution`;
      const start = Date.now();

      const result = (await originalMethod.apply(this, args)) as unknown;

      const time = Date.now() - start;
      logger.log(`${label} took ${time}ms`);

      return result;
    };

    return descriptor;
  };
}
