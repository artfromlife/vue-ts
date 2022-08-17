import type { GlobalAPI } from 'types/global-api'
import { mergeOptions } from '../util/index'

export function initMixin(Vue: GlobalAPI) {
  Vue.mixin = function (mixin: Object) {
    // 静态方法中的this , 就是Vue , 这里把Vue 看作一个对象就好
    this.options = mergeOptions(this.options, mixin)
    return this
  }
}
