function format(template, values = {}) {
  return Object.entries(values).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    String(template || '')
  );
}

function fallback(t, key, es, en) {
  const translated = t(key);
  if (translated && translated !== key) return translated;
  return document.documentElement.lang === 'en' ? en : es;
}

function makeButton(label, onClick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.addEventListener('click', onClick);
  return button;
}

export function renderReadingQueue({ root, client, t, onOpenBook, router = null, standalone = false }) {
  root.replaceChildren();

  if (standalone) {
    const back = makeButton(t('nav.back'), () => router?.back());
    back.className = 'back-button';
    root.append(back);
  }

  const heading = document.createElement(standalone ? 'h1' : 'h2');
  heading.textContent = fallback(t, 'readingLibrary.queue', 'Cola de lectura', 'Reading queue');
  if (standalone) {
    heading.dataset.screenHeading = '';
    heading.tabIndex = -1;
  }

  const intro = document.createElement('p');
  intro.textContent = fallback(
    t,
    'readingQueue.intro',
    'Ordena aquí lo que quieres leer después. Nada se abre automáticamente.',
    'Arrange what you want to read next. Nothing opens automatically.'
  );

  const status = document.createElement('p');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');

  const list = document.createElement('ol');
  list.className = 'reading-queue-list';
  root.append(heading, intro, status, list);

  let generation = 0;

  async function refresh() {
    const currentGeneration = ++generation;
    const items = await client.listQueue();
    if (currentGeneration !== generation) return;
    list.replaceChildren();

    if (!items.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = fallback(t, 'readingQueue.empty', 'La cola de lectura está vacía.', 'The reading queue is empty.');
      list.replaceWith(empty);
      empty.replaceWith(list);
      const item = document.createElement('li');
      item.textContent = empty.textContent;
      list.append(item);
      return;
    }

    items.forEach((book, index) => {
      const item = document.createElement('li');
      const title = document.createElement('strong');
      title.textContent = book.title || t('readingLibrary.untitled');
      item.append(title);

      if (book.author) {
        const author = document.createElement('span');
        author.className = 'muted';
        author.textContent = ` — ${book.author}`;
        item.append(author);
      }

      const actions = document.createElement('div');
      actions.className = 'reading-queue-actions';

      actions.append(makeButton(
        fallback(t, 'readingQueue.open', 'Abrir', 'Open'),
        () => onOpenBook?.(book.id)
      ));

      const earlier = makeButton(
        fallback(t, 'readingQueue.moveEarlier', 'Mover antes', 'Move earlier'),
        async () => {
          if (index <= 0) return;
          earlier.disabled = true;
          const moved = await client.moveQueueItem(book.id, index - 1);
          status.textContent = moved
            ? fallback(t, 'readingQueue.moved', 'Cola actualizada.', 'Queue updated.')
            : fallback(t, 'readingQueue.failed', 'No se pudo actualizar la cola.', 'The queue could not be updated.');
          await refresh();
        }
      );
      earlier.disabled = index === 0;
      actions.append(earlier);

      const later = makeButton(
        fallback(t, 'readingQueue.moveLater', 'Mover después', 'Move later'),
        async () => {
          if (index >= items.length - 1) return;
          later.disabled = true;
          const moved = await client.moveQueueItem(book.id, index + 1);
          status.textContent = moved
            ? fallback(t, 'readingQueue.moved', 'Cola actualizada.', 'Queue updated.')
            : fallback(t, 'readingQueue.failed', 'No se pudo actualizar la cola.', 'The queue could not be updated.');
          await refresh();
        }
      );
      later.disabled = index === items.length - 1;
      actions.append(later);

      actions.append(makeButton(
        fallback(t, 'readingQueue.remove', 'Quitar de la cola', 'Remove from queue'),
        async event => {
          event.currentTarget.disabled = true;
          const removed = await client.removeFromQueue(book.id);
          status.textContent = removed
            ? fallback(t, 'readingQueue.removed', 'Quitado de la cola.', 'Removed from the queue.')
            : fallback(t, 'readingQueue.failed', 'No se pudo actualizar la cola.', 'The queue could not be updated.');
          await refresh();
        }
      ));

      item.append(actions);
      list.append(item);
    });
  }

  void refresh();
  return { refresh };
}
