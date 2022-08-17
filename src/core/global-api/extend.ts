import { ASSET_TYPES } from 'shared/constants'
import type { Component } from 'types/component'
import type { GlobalAPI } from 'types/global-api'
import { defineComputed, proxy } from '../instance/state'
import { extend, mergeOptions, validateComponentName } from '../util/index'
import { getComponentName } from '../vdom/create-component'

export function initExtend(Vue: GlobalAPI) {
  /**
   * Each instance constructor, including Vue, has a unique
   * cid. This enables us to create wrapped "child
   * constructors" for prototypal inheritance and cache them.
   */
  Vue.cid = 0
  let cid = 1

  /**
   * Class inheritance
   */
  // 传入一个选项， 返回一个组件（）
  Vue.extend = function (extendOptions: any): typeof Component {
    extendOptions = extendOptions || {}
    const Super = this  // Super -> Vue
    const SuperId = Super.cid // -> 0
    // 你传进来的选项是否有 _Ctor , 没有的话，_Ctor = {}
    const cachedCtors = extendOptions._Ctor || (extendOptions._Ctor = {})
    if (cachedCtors[SuperId]) { // 如果 _Ctor[0], 明显没有值
      return cachedCtors[SuperId]
    }

    const name = // name | __name | _componentTag , 显然 Vue是没有的
      getComponentName(extendOptions) || getComponentName(Super.options)
    if (__DEV__ && name) {
      validateComponentName(name)
    }

    const Sub = function VueComponent(this: any, options: any) {
      // 这个This 又是啥啊, 这要看你怎么运行这个Sub了
      this._init(options)
    } as unknown as typeof Component
    // Super 还是 Vue, Sub -> {} -> Vue.prototype
    Sub.prototype = Object.create(Super.prototype)
    // 细节
    Sub.prototype.constructor = Sub
    // 来一个新Vue cid就加一下
    Sub.cid = cid++
    // 这就是核心, 选项合并， 咋说呢， 不知道这个咋合并的，父类的options里的内同只是把key搞过来了
    // extendOptions 估计还没有 _base 把
    Sub.options = mergeOptions(Super.options, extendOptions)
    // 这样每一个子构造器的 super 都他妈指向了 Vue
    Sub['super'] = Super

    // For props and computed properties, we define the proxy getters on
    // the Vue instances at extension time, on the extended prototype. This
    // avoids Object.defineProperty calls for each instance created.
    if (Sub.options.props) {
      initProps(Sub)
    }
    if (Sub.options.computed) {
      initComputed(Sub)
    }

    // allow further extension/mixin/plugin usage
    // 把这个extend 给了子构造器， 子构造器执行extend就递归了， super 指向父类， 实至名归！
    Sub.extend = Super.extend
    Sub.mixin = Super.mixin
    // 这是不是插件就失效了啊。。。
    Sub.use = Super.use

    // create asset registers, so extended classes
    // can have their private assets too.
    // 只是把3 个静态函数抄过来了
    ASSET_TYPES.forEach(function (type) {
      Sub[type] = Super[type]
    })
    // enable recursive self-lookup
    if (name) {
      Sub.options.components[name] = Sub
    }

    // keep a reference to the super options at extension time.
    // later at instantiation we can check if Super's options have
    // been updated.
    Sub.superOptions = Super.options
    Sub.extendOptions = extendOptions
    Sub.sealedOptions = extend({}, Sub.options)

    // cache constructor
    // 这个就是options._Ctor = { superCId : 自己 }
    cachedCtors[SuperId] = Sub
    return Sub
  }
}

function initProps(Comp: typeof Component) {
  const props = Comp.options.props
  for (const key in props) {
    proxy(Comp.prototype, `_props`, key)
  }
}

function initComputed(Comp: typeof Component) {
  const computed = Comp.options.computed
  for (const key in computed) {
    defineComputed(Comp.prototype, key, computed[key])
  }
}
