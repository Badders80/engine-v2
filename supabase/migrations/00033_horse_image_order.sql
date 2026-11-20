-- R2 keys remain the upload sequence (`01..NN`). This vector stores the
-- operator-selected display sequence, with its first entry acting as the cover.
-- Keeping the sequence as data avoids copying or renaming public objects when
-- an operator changes the cover or gallery order.
alter table public.horses
  add column image_order smallint[] not null default '{}'::smallint[];

alter table public.horses
  add constraint horses_image_order_shape check (
    cardinality(image_order) <= 100
    and array_position(image_order, null) is null
    and 0 < all(image_order)
  );

comment on column public.horses.image_order is
  'Image numbers in display order; position 1 is the cover. The bucket key remains image_number under the horse slug.';
