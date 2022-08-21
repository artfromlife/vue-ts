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
  // 传入一个选项， 返回一个构造函数吧
  Vue.extend = function (extendOptions: any): typeof Component {
    extendOptions = extendOptions || {}
    // 扩展选项
    const Super = this  // Super -> Vue
    const SuperId = Super.cid // -> 0
    // 你传进来的选项是否有 _Ctor , 没有的话，_Ctor = {}
    const cachedCtors = extendOptions._Ctor || (extendOptions._Ctor = {})
    if (cachedCtors[SuperId]) { // 如果 _Ctor[0], 明显没有值
      // 防止一个 options 被同一个基类构造函数扩展2次 ， why?
      return cachedCtors[SuperId]
    }

    const name = // name | __name | _componentTag , 显然 Vue是没有的
      getComponentName(extendOptions) || getComponentName(Super.options)
    if (__DEV__ && name) {
      validateComponentName(name)
    }
    // 扩展出子类构造函数
    const Sub = function VueComponent(this: any, options: any) {
      // 这个This 又是啥啊, 这要看你怎么运行这个Sub了
      // 最后执行 new Sub , 这个 this 就是 sub 实例， 通过原型链的形式拿到 Sub.prototype.__proto__._init
      this._init(options)
    } as unknown as typeof Component
    // 构造函数的继承    这个属于什么继承呢 高程里面讲的有
    Sub.prototype = Object.create(Super.prototype)
    Sub.prototype.constructor = Sub
    // 创造出一个新的 Vue 构造函数 cid 就加一下
    Sub.cid = cid++
    // Vue.options 中都有啥呢 , components , filters , directives , _base
    // 根据合并策略进行选项合并 , components , filters , directives 都是通过原型链的方式合并的，创建一个新的对象， 原型是父类对象
    Sub.options = mergeOptions(Super.options, extendOptions)
    // 每个扩展后的构造函数 都有一个 super 指向他的基类构造函数
    Sub['super'] = Super

    // For props and computed properties, we define the proxy getters on
    // the Vue instances at extension time, on the extended prototype. This
    // avoids Object.defineProperty calls for each instance created.
    if (Sub.options.props) {
      // 把 props 中具体的某个prop 的访问 代理到 扩展后的构造函数的原型上去 ,实际操作的是 Sub.prototype._props[prop]
      // 这样所有组件实例的 prop 都指向了同一个原型
      initProps(Sub)
    }
    if (Sub.options.computed) {
      // computed 的访问也代理到原型上去
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

    // Sub.options 中 有 _base , components 中还有自己 , 就是extendOptions中绝大部分东西
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
