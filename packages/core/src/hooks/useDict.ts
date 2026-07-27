import { onMounted, ref, type Ref } from 'vue';
import type { AxiosInstance } from 'axios';
import type { DictDataVO } from '@pivotos/types';

/**
 * 字典 hook：GET /system/dict/data/type/{dictType}（登录即可读，无需权限点）
 *
 * 用法（S11/S12 注入 request 后）:
 *   const dictHook = createUseDict(request);
 *   const { sys_user_gender } = dictHook('sys_user_gender');
 */
export function createUseDict(request: AxiosInstance) {
  const cache = new Map<string, Ref<DictDataVO[]>>();

  return function useDict(...types: string[]) {
    const result: Record<string, Ref<DictDataVO[]>> = {};

    onMounted(() => {
      types.forEach((type) => {
        if (!cache.has(type)) {
          const data = ref<DictDataVO[]>([]);
          cache.set(type, data);
          request
            .get<unknown, DictDataVO[]>(`/system/dict/data/type/${type}`, { silent: true })
            .then((list) => {
              data.value = list ?? [];
            })
            .catch(() => {});
        }
        result[type] = cache.get(type)!;
      });
    });

    return result;
  };
}
