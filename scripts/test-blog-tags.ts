// Blog etiketleri (referans "Etiketler (virgülle)"): ayrıştırma, editör alanı,
// kayıt yolu ve additive migration. Ağ / veritabanı çağrısı yok.
// Çalıştırma: npx --yes tsx scripts/test-blog-tags.ts
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { BLOG_TAG_LIMIT, parseBlogTags } from "../src/lib/admin/blog";

const root = path.resolve(__dirname, "..");
const read = (rel: string) => fs.readFileSync(path.join(root, rel), "utf8");

assert.deepEqual(parseBlogTags("SAT, Matematik"), ["SAT", "Matematik"]);
assert.deepEqual(parseBlogTags(" SAT ,, sat ,  Matematik   Olimpiyat ,"), ["SAT", "Matematik Olimpiyat"]);
assert.deepEqual(parseBlogTags("İngilizce, ingilizce"), ["İngilizce"]);
assert.deepEqual(parseBlogTags(""), []);
assert.deepEqual(parseBlogTags(null), []);
assert.deepEqual(parseBlogTags(["IB", "IB", " AP "]), ["IB", "AP"]);
assert.equal(parseBlogTags(Array.from({ length: 30 }, (_, i) => `t${i}`).join(",")).length, BLOG_TAG_LIMIT);
assert.equal(parseBlogTags("x".repeat(90))[0].length, 40);
// DB kısıtı (blog_posts_tags_limits): 12 etiket ve birleşik uzunluk ≤ 400.
const worst = parseBlogTags(Array.from({ length: 12 }, (_, i) => `${i}`.padEnd(60, "x")).join(","));
assert.ok(worst.join(",").length <= 400 && worst.length <= BLOG_TAG_LIMIT);
assert.match(read("supabase/migrations/20261007101000_blog_post_tags.sql"), /<= 12 and char_length\(array_to_string\(tags, ','\)\) <= 400/);

const editor = read("src/components/admin/BlogEditorPage.tsx");
assert.match(editor, /<label htmlFor="be-etiket" className="m-lab">Etiketler <span className="m-opt">\(virgülle\)<\/span><\/label>/);
assert.match(editor, /id="be-etiket"[^>]*placeholder="Örn\. SAT, Matematik"/);
assert.ok(editor.indexOf('id="be-yazar"') < editor.indexOf('id="be-etiket"') && editor.indexOf('id="be-etiket"') < editor.indexOf('id="be-tarih"'), "Yazar → Etiketler → Yayın tarihi sırası");
assert.equal((editor.match(/tags: parseBlogTags\(snapshot\.tags\)/g) || []).length, 2, "oluşturma ve güncelleme etiketleri kaydediyor");
assert.match(editor, /tags: \(data\.tags \?\? \[\]\)\.join\(", "\)/);

const blog = read("src/lib/admin/blog.ts");
assert.match(blog, /tags: parseBlogTags\(input\.tags\),/);
assert.match(blog, /if \(input\.tags !== undefined\) updatePayload\.tags = parseBlogTags\(input\.tags\);/);

const migration = read("supabase/migrations/20261007101000_blog_post_tags.sql").replace(/--.*$/gm, "");
assert.match(migration, /add column if not exists tags text\[\] not null default '\{\}'/);
assert.doesNotMatch(migration, /\b(drop|truncate|delete|update)\b/i);

console.log("blog tags: PASS");
