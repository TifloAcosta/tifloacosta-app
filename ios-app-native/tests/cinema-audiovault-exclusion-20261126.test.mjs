import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../Sources/', import.meta.url));
function sourceFiles(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
        const path = join(directory, entry.name);
        return entry.isDirectory() ? sourceFiles(path)
            : /\.(swift|strings|json|plist|html|js|mjs|c|h)$/i.test(entry.name) ? [path] : [];
    });
}
test('AudioVault remains absent from shipped native source, directory, search and localization', () => {
    const paths = sourceFiles(root);
    assert.ok(paths.some(path => path.endsWith('NativeAccessibleCinema.swift')));
    for (const path of paths) {
        assert.doesNotMatch(readFileSync(path, 'utf8'), /audio[\s_-]*vault/i, path);
    }
});
test('provider exclusion is documented as an explicit negative response', () => {
    const decision = readFileSync(new URL('../cinema-provider-verification-20261125.md', import.meta.url), 'utf8');
    assert.match(decision, /AudioVault: excluido expresamente por decisión editorial del 26-11-2026 tras la respuesta negativa del proveedor/);
});
