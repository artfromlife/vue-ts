import { ASSET_TYPES } from 'shared/constants'
import type { GlobalAPI } from 'types/global-api'
import { isFunction, isPlainObject, validateComponentName } from '../util/index'

export function initAssetRegisters(Vue: GlobalAPI) {
  /**
   * Create asset registration methods.
   */
  ASSET_TYPES.forEach(type => {
    // @ts-expect-error function is not exact same type
    Vue[type] = function (
      id: string,                      // 组件全局注册, 指令全局注册 ， 过滤器全局注册 都是一样的
      definition?: Function | Object   // 这里传一个函数是啥意思， 传一个选项我还能理解
    ): Function | Object | void {
      if (!definition) { // 没有传定义 ， 定义过就返回
        return this.options[type + 's'][id]
      } else {
        /* istanbul ignore if */
        if (__DEV__ && type === 'component') {
          validateComponentName(id)
        }
        if (type === 'component' && isPlainObject(definition)) {
          // @ts-expect-error
          definition.name = definition.name || id
          console.log(`regis ${(definition as any).name }`)
          // 就是这个 _base 一定是 初始的第一个Vue 构造函数吗 , component 相当于挂上了一个 Vue.extend() 返回的构造函数
          definition = this.options._base.extend(definition)
        }
        if (type === 'directive' && isFunction(definition)) {
          definition = { bind: definition, update: definition }
        }
        // 这个就过滤器没有经过特殊的处理
        // 给 Ctor.options 上加内容了
        this.options[type + 's'][id] = definition
        return definition
      }
    }
  })
}
