import type { Permission } from "@sprachpilot/shared";
import { can, ForbiddenError } from "@sprachpilot/shared";
import type { Express, NextFunction, Request, RequestHandler, Response, Router } from "express";

import { getRequestAuth } from "../auth/require-auth.js";

export type RouteAccess = { kind: "public" } | { kind: "permission"; permission: Permission };

export interface DeclaredRoute {
  method: string;
  path: string;
  access: RouteAccess;
}

const accessByLayer = new WeakMap<object, RouteAccess>();
const mountByRouter = new WeakMap<object, string>();
const declaredMountByLayer = new WeakMap<object, { path: string; access: RouteAccess }>();
const undeclaredMountByLayer = new WeakMap<object, string>();

interface StackLayer {
  route?: { path: string; methods: Record<string, boolean> };
  handle: { stack?: StackLayer[] };
}

export function tagRouter(router: Router, mountPath: string): Router {
  mountByRouter.set(router, mountPath);
  const originalUse = router.use.bind(router);
  router.use = ((...args: unknown[]) => {
    const mountedPath = typeof args[0] === "string" ? args[0] : undefined;
    const result = (originalUse as (...useArgs: unknown[]) => Router)(...args);
    if (mountedPath) noteUnmarkedMount(router, mountedPath);
    return result;
  }) as Router["use"];
  return router;
}

/**
 * A non-router mount such as the docs UI. Path mounts on a tagged router that
 * skip this helper are reported as undeclared.
 */
export function bindMount(
  router: Router,
  path: string,
  access: RouteAccess,
  handler: RequestHandler,
): void {
  router.use(path, handler);
  declareMount(router, path, access);
}

/** Marks the mount just registered with `router.use`. */
export function declareMount(router: Router, path: string, access: RouteAccess): void {
  const layer = lastLayer(router);
  if (!layer) throw new Error(`USE ${path} was not registered`);
  undeclaredMountByLayer.delete(layer);
  declaredMountByLayer.set(layer, { path, access });
}

export function bindRoute(
  router: Router,
  method: "get" | "post" | "patch" | "put" | "delete",
  path: string,
  access: RouteAccess,
  handlers: readonly RequestHandler[],
  requireAuth?: RequestHandler,
): void {
  const gate: RequestHandler[] = [];
  if (access.kind === "permission") {
    if (!requireAuth) {
      throw new Error(`${method.toUpperCase()} ${path} declares ${access.permission} without auth`);
    }
    gate.push(createRequirePermission(requireAuth, access.permission));
  }

  const routeHandlers = [...gate, ...handlers];
  switch (method) {
    case "get":
      router.get(path, ...routeHandlers);
      break;
    case "post":
      router.post(path, ...routeHandlers);
      break;
    case "patch":
      router.patch(path, ...routeHandlers);
      break;
    case "put":
      router.put(path, ...routeHandlers);
      break;
    case "delete":
      router.delete(path, ...routeHandlers);
      break;
  }
  const stack = (router as unknown as { stack: object[] }).stack;
  const layer = stack.at(-1);
  if (!layer) throw new Error(`${method.toUpperCase()} ${path} was not registered`);
  accessByLayer.set(layer, access);
}

/**
 * Auth first, then the token role against one permission. No database read.
 */
export function createRequirePermission(
  requireAuth: RequestHandler,
  permission: Permission,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    requireAuth(req, res, (error?: unknown) => {
      if (error) {
        next(error);
        return;
      }
      try {
        const auth = getRequestAuth(req);
        if (!can(auth.role, permission)) {
          next(new ForbiddenError());
          return;
        }
        next();
      } catch (caught) {
        next(caught);
      }
    });
  };
}

export function listAppRoutes(app: Express): Array<DeclaredRoute & { declared: boolean }> {
  const root = (app as unknown as { router: object }).router;
  return walk(root, "");
}

export function undeclaredRoutes(app: Express): string[] {
  return listAppRoutes(app)
    .filter((route) => !route.declared)
    .map((route) => `${route.method} ${route.path}`);
}

function walk(
  router: object,
  inheritedPrefix: string,
): Array<DeclaredRoute & { declared: boolean }> {
  const prefix = readMount(router) ?? inheritedPrefix;
  const found: Array<DeclaredRoute & { declared: boolean }> = [];

  for (const layer of routerStack(router)) {
    const declaredMount = declaredMountByLayer.get(layer);
    if (declaredMount) {
      found.push({
        method: "ALL",
        path: joinPath(prefix, declaredMount.path),
        access: declaredMount.access,
        declared: true,
      });
      continue;
    }

    const unmarkedPath = undeclaredMountByLayer.get(layer);
    if (unmarkedPath) {
      found.push({
        method: "ALL",
        path: joinPath(prefix, unmarkedPath),
        access: { kind: "public" },
        declared: false,
      });
      continue;
    }

    if (layer.route) {
      const access = readAccess(layer);
      const path = joinPath(prefix, layer.route.path);
      for (const method of routeMethods(layer.route.methods)) {
        found.push({
          method,
          path,
          access: access ?? { kind: "public" },
          declared: access !== undefined,
        });
      }
      continue;
    }

    if (layer.handle.stack) found.push(...walk(layer.handle, prefix));
  }

  return found;
}

function routeMethods(methods: Record<string, boolean>): string[] {
  return Object.entries(methods)
    .filter(([, enabled]) => enabled)
    .map(([method]) => method.toUpperCase());
}

function routerStack(router: object): StackLayer[] {
  const stack = (router as { stack?: StackLayer[] }).stack;
  return stack ?? [];
}

function noteUnmarkedMount(router: Router, mountedPath: string): void {
  const layer = lastLayer(router);
  if (!layer || accessByLayer.has(layer) || declaredMountByLayer.has(layer)) return;
  const handle = (layer as { handle?: { stack?: unknown } }).handle;
  if (handle?.stack) return;
  undeclaredMountByLayer.set(layer, mountedPath);
}

function lastLayer(router: Router): object | undefined {
  return (router as unknown as { stack: object[] }).stack.at(-1);
}

function readMount(router: object): string | undefined {
  return mountByRouter.get(router);
}

function readAccess(layer: object): RouteAccess | undefined {
  return accessByLayer.get(layer);
}

function joinPath(prefix: string, path: string): string {
  if (prefix.length === 0) return path;
  if (path === "/") return prefix;
  const left = prefix.endsWith("/") ? prefix.slice(0, -1) : prefix;
  const right = path.startsWith("/") ? path : `/${path}`;
  return `${left}${right}`;
}
