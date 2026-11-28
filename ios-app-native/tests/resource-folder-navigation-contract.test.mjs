import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const model = fs.readFileSync(new URL('../Sources/NativeCatalogStore.swift', import.meta.url), 'utf8');
const screens = fs.readFileSync(new URL('../Sources/NativeScreens.swift', import.meta.url), 'utf8');

test('catalog accepts optional nested resource paths without requiring schema migration', () => {
    assert.match(model, /var folderPath: \[String\]\? = nil/);
    assert.match(model, /\(folderPath \?\? \[\]\)/);
    assert.match(model, /\[category \?\? ""\] \+ resourceFolderPath/);
    assert.match(model, /resourceLocation, description \?\? "", summary/);
    assert.match(model, /searchText \?\? ""/);
});

test('resource browsing separates direct documents from children and permits nested searches', () => {
    assert.match(screens, /items\.filter \{ \$0\.resourceFolderPath == path \}/);
    assert.match(screens, /Array\(components\.prefix\(path\.count\)\) == path/);
    assert.match(screens, /path: path \+ \[folder\]/);
    assert.match(screens, /descendants\.filter \{ \$0\.matchesResourceQuery\(query\) \}/);
    assert.match(screens, /if isSearchingResources \{[\s\S]*?return item\.matchesResourceQuery\(resourceQuery\)[\s\S]*?return item\.category == chosenCategory/);
    assert.match(screens, /\.accessibilityValue\(Text\(item\.resourceLocation \+ \(resourceService\.isAvailableOffline\(item\)/);
    assert.match(screens, /if isPillsCategory && !isSearchingResources/);
});

test('empty resource search translated into the five non-source app languages', () => {
    for (const language of ['en', 'fr', 'it', 'pt', 'de']) {
        const strings = fs.readFileSync(new URL('../Sources/' + language + '.lproj/Localizable.strings', import.meta.url), 'utf8');
        assert.equal((strings.match(/^"No hay resultados\."\s*=/gm) || []).length, 1, language);
    }
});

test('home global search uses the same nested resource index, includes all resource languages and announces location', () => {
    const global = fs.readFileSync(new URL('../Sources/NativeSearch.swift', import.meta.url), 'utf8');
    assert.match(global, /let resources = catalog\.resources\.map/);
    assert.match(global, /if match\.kind == \.resource \{ return match\.item\.matchesResourceQuery\(query\) \}/);
    assert.match(global, /Text\(match\.item\.resourceLocation\)/);
    assert.match(global, /\.accessibilityValue\(Text\(match\.item\.resourceLocation\)\)/);
    assert.match(global, /first\.item\.lang == preferredLanguage/);
});
