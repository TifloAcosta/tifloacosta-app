import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = name => readFileSync(new URL('../Sources/' + name, import.meta.url), 'utf8');
const library = source('NativePodcastLibrary.swift');
const screen = source('NativePodcasts.swift');
const youtube = source('NativeYouTubeAccount.swift');

test('podcast subscriptions and favorites persist independently of YouTube', () => {
    assert.match(library, /UserDefaults\.standard/);
    assert.match(library, /func toggleFavorite/);
    assert.match(library, /func follow\(/);
    assert.match(library, /func unfollow\(/);
});

test('OPML is bounded and never resolves XML external entities', () => {
    assert.match(library, /data\.count <= 2_000_000/);
    assert.match(library, /parser\.shouldResolveExternalEntities = false/);
    assert.match(library, /func importOPML/);
    assert.match(screen, /\.fileImporter\(/);
});

test('followed podcasts offer feed browsing and new episode counts', () => {
    assert.match(screen, /loadFollowed\(/);
    assert.match(screen, /Consultar episodios/);
    assert.match(library, /func recordFeedCheck/);
    assert.match(screen, /library\.recordFeedCheck/);
});

test('YouTube subscription list uses existing authorized session and pagination', () => {
    assert.match(youtube, /func loadSubscriptions\(/);
    assert.match(youtube, /subscriptionsNextPageToken/);
    assert.match(youtube, /"subscriptions"/);
    assert.match(youtube, /guard authenticated/);
});
