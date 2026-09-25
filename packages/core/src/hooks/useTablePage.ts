import { getCurrentInstance, onActivated, reactive, ref, type Ref } from 'vue';
import type { AxiosInstance, AxiosRequestConfig } from 'axios';
import type { PageQuery, PageResult } from '@pivotos/types';

export interface TablePageOptions<T, Q extends PageQuery = PageQuery> {
  /** 列表接口地址，如 /system/user/page */
  url: string;
  /** 初始查询条件（不含分页参数） */
  query?: Q;
  /** 进入页面立即加载，默认 true */
  immediate?: boolean;
  /**
   * 标签页重新激活（keep-alive 唤醒）时自动刷新数据，默认 true。
   * 只重新拉取当前页数据，分页、查询条件等页面状态全部保留。
   */
  refreshOnActivate?: boolean;
  /** 响应数据后处理 */
  transform?: (rows: T[]) => T[];
}

/** 分页表格通用 hook：loading / rows / total / 查询 / 重置 / 翻页 */
export function createUseTablePage(request: AxiosInstance) {
  return function useTablePage<T, Q extends PageQuery = PageQuery>(
    options: TablePageOptions<T, Q>,
  ) {
    const { url, query, immediate = true, transform } = options;

    const loading = ref(false);
    // 显式标注为 Ref<T[]>：保留 Ref 品牌，模板中由 vue-tsc 自动拆包
    const rows: Ref<T[]> = ref([]) as Ref<T[]>;
    const total = ref(0);
    const params = reactive({
      pageNum: 1,
      pageSize: 10,
      ...(query ?? {}),
    }) as Q & Required<Pick<PageQuery, 'pageNum' | 'pageSize'>>;

    async function load(config?: AxiosRequestConfig): Promise<void> {
      loading.value = true;
      try {
        // 空值参数（''/undefined/null）不下发：'' 是查询表单"请选择"空值项的选中值
        const cleaned = Object.fromEntries(
          Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null),
        );
        const page = await request.get<unknown, PageResult<T>>(url, {
          params: cleaned,
          ...config,
        });
        rows.value = transform ? transform(page.list ?? []) : (page.list ?? []);
        total.value = page.total ?? 0;
      } finally {
        loading.value = false;
      }
    }

    /** 查询（回到第一页） */
    function search(): Promise<void> {
      params.pageNum = 1;
      return load();
    }

    /** 重置查询条件并查询 */
    function reset(): Promise<void> {
      Object.keys(params).forEach((key) => {
        if (key !== 'pageNum' && key !== 'pageSize') {
          delete (params as Record<string, unknown>)[key];
        }
      });
      Object.assign(params, query ?? {});
      return search();
    }

    if (immediate) void load();

    // 切换回标签页时刷新数据（分页 / 查询条件由 keep-alive 保留，这里只重拉当前页）
    if (getCurrentInstance() && (options.refreshOnActivate ?? true)) {
      // 首次激活紧接 immediate 首载，跳过避免重复请求
      let skipFirstActivation = immediate;
      onActivated(() => {
        if (skipFirstActivation) {
          skipFirstActivation = false;
          return;
        }
        void load();
      });
    }

    return { loading, rows, total, params, load, search, reset };
  };
}
