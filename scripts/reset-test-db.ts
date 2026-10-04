import postgres from 'postgres'

// The layout tests need an empty database, and `admin reset` refuses to delete a week
// that has orders, which the unit suite leaves behind on the same Postgres. This is a
// separate file because it must never be reachable from the admin CLI that points at
// the live database.
const url = process.env.DATABASE_URL
if (!url) throw new Error('DATABASE_URL is not set')
if (!/localhost|127\.0\.0\.1/.test(url)) throw new Error('refusing to empty a database that is not local')

async function main() {
  const sql = postgres(url!, { max: 1 })
  await sql.unsafe(`
    do $$
    declare tables text;
    begin
      select string_agg(format('%I.%I', schemaname, tablename), ', ')
        into tables
        from pg_tables
       where schemaname = 'public'
         and tablename <> '__drizzle_migrations';
      if tables is not null then
        execute 'truncate ' || tables || ' restart identity cascade';
      end if;
    end $$;
  `)
  await sql.end()
  console.log('test database emptied')
}
main()
