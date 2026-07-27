import type { Directive, DirectiveBinding } from 'vue';
import { hasPermi, hasRole } from '../permission/checker';

function removeEl(el: HTMLElement): void {
  el.parentNode?.removeChild(el);
}

function mounted(check: (v: string | string[]) => boolean) {
  return (el: HTMLElement, binding: DirectiveBinding<string | string[]>) => {
    const value = binding.value;
    if (value == null || (Array.isArray(value) && value.length === 0)) return;
    if (!check(value)) removeEl(el);
  };
}

/** v-hasPermi="'system:user:add'" 或 v-hasPermi="['a','b']"(OR) */
export const vHasPermi: Directive<HTMLElement, string | string[]> = {
  mounted: mounted(hasPermi),
};

/** v-hasRole="'admin'" */
export const vHasRole: Directive<HTMLElement, string | string[]> = {
  mounted: mounted(hasRole),
};

/** 一键注册（宿主 app.use 风格） */
export function setupPermissionDirectives(app: {
  directive: (name: string, dir: Directive) => void;
}): void {
  app.directive('hasPermi', vHasPermi);
  app.directive('hasRole', vHasRole);
}
