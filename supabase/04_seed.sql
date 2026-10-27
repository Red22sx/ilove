-- =====================================================================
-- ILOVE MOBILE — 04_seed.sql  (categorias e referências de preço)
-- Os valores de referência são DEMONSTRATIVOS (is_demo = true): não são pesquisa de mercado.
-- =====================================================================
insert into public.service_categories(slug, name, position) values
  ('companhia', 'Companhia', 1), ('danca', 'Dança', 2), ('massagem', 'Massagem', 3), ('conversa-online', 'Conversa online', 4),
  ('coaching', 'Coaching de imagem', 5), ('fotografia', 'Ensaio fotográfico', 6), ('eventos', 'Acompanhante em eventos', 7)
on conflict (slug) do update set name = excluded.name, position = excluded.position;

delete from public.price_references where is_demo;
insert into public.price_references(category_slug, region, mode, min_cents, max_cents, reference_duration_min, source, is_demo) values
  ('companhia', '', 'presencial', 12000, 45000, 60, 'Valor demonstrativo (não é pesquisa de mercado)', true),
  ('danca', '', 'presencial', 10000, 25000, 60, 'Valor demonstrativo (não é pesquisa de mercado)', true),
  ('massagem', '', 'presencial', 12000, 30000, 60, 'Valor demonstrativo (não é pesquisa de mercado)', true),
  ('conversa-online', '', 'remoto', 6000, 20000, 60, 'Valor demonstrativo (não é pesquisa de mercado)', true),
  ('coaching', '', 'ambos', 10000, 28000, 60, 'Valor demonstrativo (não é pesquisa de mercado)', true),
  ('fotografia', '', 'presencial', 18000, 50000, 60, 'Valor demonstrativo (não é pesquisa de mercado)', true),
  ('eventos', '', 'presencial', 30000, 90000, 180, 'Valor demonstrativo (não é pesquisa de mercado)', true);
