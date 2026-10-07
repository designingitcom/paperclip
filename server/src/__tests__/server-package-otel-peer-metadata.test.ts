import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The seven OpenTelemetry packages `server/src/instrumentation.ts` loads
 * through a dynamic import. Each one must be an optional peer dependency, not
 * a normal dependency, so a default install never pulls in the SDK. This test
 * guards the manifest half of that contract; `instrumentation.test.ts` guards
 * the runtime half (the bootstrap fails open when a package is absent).
 */

const RUNTIME_OTEL_PACKAGES = [
  "@opentelemetry/sdk-node",
  "@opentelemetry/auto-instrumentations-node",
  "@opentelemetry/resources",
  "@opentelemetry/semantic-conventions",
  "@opentelemetry/exporter-trace-otlp-proto",
] as const;

const OPTIONAL_EXPORTER_PACKAGES = [
  "@opentelemetry/exporter-trace-otlp-grpc",
  "@opentelemetry/exporter-trace-otlp-http",
] as const;

const OTEL_PACKAGES = [...RUNTIME_OTEL_PACKAGES, ...OPTIONAL_EXPORTER_PACKAGES] as const;
const packageJsonPath = fileURLToPath(new URL("../../package.json", import.meta.url));

describe("server package OpenTelemetry peer metadata", () => {
  const packageJson = JSON.parse(readFileSync(packageJsonPath, "utf8")) as {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
    peerDependencies?: Record<string, string>;
    peerDependenciesMeta?: Record<string, { optional?: boolean }>;
  };

  it.each(RUNTIME_OTEL_PACKAGES)(
    "installs %s as a normal runtime dependency",
    (packageName) => {
      expect(packageJson.dependencies?.[packageName]).toBeDefined();
      expect(packageJson.devDependencies?.[packageName]).toBeUndefined();
    },
  );

  it.each(OPTIONAL_EXPORTER_PACKAGES)(
    "keeps %s out of normal dependencies",
    (packageName) => {
      expect(packageJson.dependencies?.[packageName]).toBeUndefined();
      expect(packageJson.devDependencies?.[packageName]).toBeUndefined();
    },
  );

  it.each(OTEL_PACKAGES)(
    "declares %s as an optional peer for compatible self-hosted installs",
    (packageName) => {
      expect(packageJson.peerDependencies?.[packageName]).toBeDefined();
      expect(packageJson.peerDependenciesMeta?.[packageName]?.optional).toBe(true);
    },
  );

  it("keeps @opentelemetry/api as a normal dependency", () => {
    expect(packageJson.dependencies?.["@opentelemetry/api"]).toBeDefined();
    expect(packageJson.peerDependencies?.["@opentelemetry/api"]).toBeUndefined();
  });
});
