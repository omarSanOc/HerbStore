import { baseApi } from '@/core/api/base-api';
import type { SupportedLanguage } from '@/core/i18n/languages';

import type {
  BrandOption,
  CategoryNode,
  ProductDetail,
  ProductPage,
} from '../contracts/catalog-product';
import {
  parseBrandOptions,
  parseCategoryTree,
  parseProductDetail,
  parseProductPage,
} from '../contracts/parse-catalog-product';
import { getNextPageParam } from '../logic/product-pages';
import { productListTags, productTag } from '../logic/product-tags';
import {
  describeQueryForLog,
  toProductQueryString,
  type ProductQueryArgs,
} from '../logic/product-query';

/**
 * The catalog endpoints. `injectEndpoints` adds them to the single `baseApi`, so they share the
 * store, the retry policy (2 retries on `GET` with network/5xx, 0 on 4xx) and the 60 s / 300 s
 * cache rules with Home. Each endpoint states its result type with a bounded `transformResponse`
 * cast: its `parse` already validated the payload as exactly that type.
 */
export const productsApi = baseApi.injectEndpoints({
  // Fast Refresh re-runs this module and injects the same endpoints again: in development they
  // are replaced silently instead of logging an error each time; in production a duplicated
  // endpoint name stays an error (plan 004, T1, user decision).
  overrideExisting: __DEV__,
  endpoints: (build) => ({
    /**
     * `GET /products?...`: ONE cache entry per list identity (`ProductQueryArgs`, no page), whose
     * value holds every loaded page. The page is the `pageParam`, not part of the identity, and
     * the language IS part of the identity (it is in `queryArg`, never in the query string).
     */
    getProducts: build.infiniteQuery<ProductPage, ProductQueryArgs, number>({
      infiniteQueryOptions: {
        initialPageParam: 1,
        getNextPageParam,
      },
      query: ({ queryArg, pageParam }) => {
        if (__DEV__) {
          // The `[api]` log omits the query string on purpose; this line says what is asked
          // without printing the search text or any user datum (see `describeQueryForLog`).
          console.log(`[products] query ${describeQueryForLog(queryArg, pageParam)}`);
        }

        return {
          path: `/products?${toProductQueryString(queryArg, pageParam)}`,
          parse: parseProductPage,
          language: queryArg.language,
        };
      },
      transformResponse: (response) => response as ProductPage,
      providesTags: (data) => productListTags(data?.pages),
    }),

    /**
     * `GET /products/:id`. `id` must come from `parseProductId` (a malformed id never reaches the
     * request: RF-40). The language travels in the ARGUMENT, so the detail of `es` and of `en` are
     * two entries and a late answer of the old language cannot replace the current one (RF-24).
     * The answer is the detail: the catalog product plus `description`, `servingInfo` and the live
     * `stock` (see `ProductDetail`).
     */
    getProduct: build.query<ProductDetail, { id: string; language: SupportedLanguage }>({
      query: ({ id, language }) => ({
        path: `/products/${encodeURIComponent(id)}`,
        parse: parseProductDetail,
        language,
      }),
      transformResponse: (response) => response as ProductDetail,
      providesTags: (_data, _error, { id }) => [productTag(id)],
    }),

    /** `GET /products/barcode/:code`: the scanner uses the same detail contract and GET policy. */
    getProductByBarcode: build.query<ProductDetail, { code: string; language: SupportedLanguage }>({
      query: ({ code, language }) => ({
        path: `/products/barcode/${encodeURIComponent(code)}`,
        parse: parseProductDetail,
        language,
      }),
      transformResponse: (response) => response as ProductDetail,
      providesTags: (data) => (data === undefined ? [] : [productTag(data.id)]),
    }),

    /** `GET /brands`. Facet options: not tied to any product, so no tags. Localized (RF-9). */
    getBrands: build.query<BrandOption[], SupportedLanguage>({
      query: (language) => ({ path: '/brands', parse: parseBrandOptions, language }),
      transformResponse: (response) => response as BrandOption[],
    }),

    /** `GET /categories`. Category tree with subcategories: no tags either. Localized (RF-9). */
    getCategories: build.query<CategoryNode[], SupportedLanguage>({
      query: (language) => ({ path: '/categories', parse: parseCategoryTree, language }),
      transformResponse: (response) => response as CategoryNode[],
    }),
  }),
});

export const {
  useGetProductsInfiniteQuery,
  useGetProductQuery,
  useGetProductByBarcodeQuery,
  useLazyGetProductByBarcodeQuery,
  useGetBrandsQuery,
  useGetCategoriesQuery,
} = productsApi;
