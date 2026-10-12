#!/bin/sh
set -eu
# Mount a fresh Railway volume at /app/data, never over /app or the config file.
for name in uploads images logs; do
  mkdir -p "/app/data/$name"
done
for mapping in 'uploads:/app/uploads' 'images:/app/client/public/images' 'logs:/app/logs'; do
  name=${mapping%%:*}
  target=${mapping#*:}
  if [ ! -L "$target" ]; then
    if [ -d "$target" ]; then
      cp -an "$target/." "/app/data/$name/"
      rm -rf "$target"
    fi
    ln -s "/app/data/$name" "$target"
  fi
done
chown -R node:node /app/data
exec su-exec node "$@"
