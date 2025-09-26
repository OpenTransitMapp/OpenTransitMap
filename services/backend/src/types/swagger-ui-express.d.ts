declare module 'swagger-ui-express' {
  import { RequestHandler } from 'express';

  // Minimal type surface we use
  const serve: RequestHandler[];
  function setup(document: any, options?: any): RequestHandler;

  const _default: {
    serve: typeof serve;
    setup: typeof setup;
  };

  export { serve, setup };
  export default _default;
}

