import { onMounted, ref, type Ref } from 'vue';
import type { AxiosInstance } from 'axios';
import type { DictDataVO } from '@pivotos/types';

/**
 * 字典 hook：GET /system/dict/data/type/{dictType}（登录即可读，无需权限点）
 *
 * 注意：引用必须在 setup 同步创建并返回（模板在挂载前即完成解构），
 * 数据拉取放在 onMounted，加载完成后响应式刷新视图。
 *
 * 用法:
 *   const useDict = createUseDict(request);
 *   const { sys_common_status } = useDict('sys_common_status');
 */
export function createUseDict(request: AxiosInstance) {
  const cache = new Map<string, Ref<DictDataVO[]>>();

  return function useDict(...types: string[]) {
    const result: Record<string, Ref<DictDataVO[]>> = {};

    // 同步建立引用：保证调用方立即可解构，且跨组件共享同一缓存引用
    types.forEach((type) => {
      if (!cache.has(type)) {
        cache.set(type, ref<DictDataVO[]>([]));
      }
      result[type] = cache.get(type)!;
    });

    onMounted(() => {
      types.forEach((type) => {
        // 已有数据（含在途后回填）则跳过重复拉取
        if (cache.get(type)!.value.length > 0) return;
        request
          .get<unknown, DictDataVO[]>(`/system/dict/data/type/${type}`, { silent: true })
          .then((list) => {
            cache.get(type)!.value = list ?? [];
          })
          .catch(() => {});
      });
    });

    return result;
  };
}
