import { findIndex } from 'lodash'

export function closest (element, selectors) {
  if (element.closest) {
    return element.closest(selectors)
  }

  // Polyfill from https://developer.mozilla.org/en-US/docs/Web/API/Element/closest
  let matches = (element.document || element.ownerDocument).querySelectorAll(
    selectors
  )
  let i

  do {
    i = matches.length
    while (--i >= 0 && matches.item(i) !== element) {}
  } while (i < 0 && (element = element.parentElement))

  return element
}

let needIndeterminatePatch = null

function testIndeterminate () {
  let checkbox = document.createElement('input')
  checkbox.type = 'checkbox'
  checkbox.indeterminate = true
  document.body.appendChild(checkbox)
  checkbox.click()
  let needPatch = !checkbox.checked
  checkbox.parentNode.removeChild(checkbox)
  return needPatch
}

// IE won't trigger change event for indeterminate checkboxes
// Problem see http://stackoverflow.com/questions/33523130/ie-does-not-fire-change-event-on-indeterminate-checkbox-when-you-click-on-it
// A more thorough compatibility fix here:
export function patchIndeterminate (element) {
  if (needIndeterminatePatch == null) {
    needIndeterminatePatch = testIndeterminate()
  }

  if (
    !needIndeterminatePatch ||
    !element.tagName ||
    element.tagName.toLowerCase() !== 'input' ||
    !element.type ||
    element.type.toLowerCase() !== 'checkbox'
  ) {
    return
  }

  // The indeterminate status will already be changed when click event is dispatched
  // so listen to mousedown events for all associated labels
  let indeterminate
  let label = closest(element, 'label')
  let target = label || element
  let targets = label ? [label] : []
  if (element.id) {
    targets = [
      target,
      ...document.querySelectorAll(`label[for="${element.id}"]`)
    ]
  }
  targets.forEach(target => {
    target.addEventListener('mousedown', function () {
      indeterminate = element.indeterminate
    })
  })

  // Click on labels will also trigger change events for checkboxes
  element.addEventListener(
    'click',
    function () {
      if (!indeterminate) {
        return
      }
      element.checked = !element.checked
      let event = document.createEvent('HTMLEvents')
      event.initEvent('change', true, false)
      element.dispatchEvent(event)
    },
    false
  )
}

/**
 * 判断两个元素是否存在父子关系。
 * IE9 的 SVGSVGElement 上没有 contains 方法，做下 hack 。
 *
 * @param {Element} parentElem 父元素
 * @param {Element} childElem 子元素
 * @return {boolean}
 */
export function contains (parentElem, childElem) {
  return parentElem.contains
    ? parentElem.contains(childElem)
    : document.body.contains.call(parentElem, childElem)
}

/**
 * 获取离指定元素最近的可滚动的父级元素
 *
 * @param {Element} elem 指定元素
 * @param {Boolean} includeSelf 是否在自身可滚动时直接返回，默认为 `false`
 * @return {Element} 最近的可滚动父级元素
 */
export function getScrollParent (elem, includeSelf = false) {
  if (!elem) {
    return null
  }
  let current = includeSelf ? elem : elem.parentNode
  if (!current) {
    return null
  }
  if (current.scrollHeight > current.clientHeight) {
    return current
  }
  return getScrollParent(current, false)
}

const FOCUSABLE_SELECTOR = `
a[href]:not([tabindex='-1']),
area[href]:not([tabindex='-1']),
input:not([disabled]):not([tabindex='-1']),
select:not([disabled]):not([tabindex='-1']),
textarea:not([disabled]):not([tabindex='-1']),
button:not([disabled]):not([tabindex='-1']),
iframe:not([tabindex='-1']),
[tabindex]:not([tabindex='-1']),
[contentEditable=true]:not([tabindex='-1'])`

/**
 * 获取目标元素下所有可以获取焦点的元素
 *
 * @param {Element} elem 需要查找的目标元素
 * @returns {Array.<Element>} 可以获取焦点的元素数组
 */
export function getFocusable (elem) {
  return [...elem.querySelectorAll(FOCUSABLE_SELECTOR)]
}

/**
 * 将焦点移入指定元素内的第一个可聚焦的元素
 *
 * @param {Element} elem 需要查找的指定元素
 * @param {number=} index 聚焦元素在可聚焦元素的位置
 * @param {Boolean=} ignoreAutofocus 是否忽略 autofocus
 * @returns {Boolean} 是否找到可聚焦的元素
 */
export function focusIn (elem, index = 0, ignoreAutofocus) {
  if (!ignoreAutofocus) {
    let auto = elem.querySelector('[autofocus]')
    if (auto) {
      focus(auto)
      return true
    }
  }

  if (index === 0) {
    let first = elem.querySelector(FOCUSABLE_SELECTOR)
    if (first) {
      focus(first)
      return true
    }
  }

  let focusable = [...elem.querySelectorAll(FOCUSABLE_SELECTOR)]
  let count = focusable.length
  if (!count) {
    return false
  }

  focus(focusable[(index + count) % count])
  return true
}

/**
 * 聚焦到前/后第指定个可聚焦元素
 *
 * @param {HTMLElement} elem 起始元素
 * @param {number} step 偏移量
 */
function focusNav (elem, step) {
  let focusable = getFocusable(document.body)
  let index = findIndex(focusable, el => el === elem)
  if (index !== -1) {
    let next = focusable[index + step]
    if (next) {
      next.focus()
    }
  }
}

/**
 * 聚焦到上一个可聚焦元素
 *
 * @param {HTMLElement} elem 起始元素
 */
export function focusBefore (elem) {
  return focusNav(elem, -1)
}

/**
 * 聚焦到下一个可聚焦元素
 *
 * @param {HTMLElement} elem 起始元素
 */
export function focusAfter (elem) {
  return focusNav(elem, 1)
}

/**
 * 安全地 focus 一个元素
 *
 * @param {HTMLElement} elem
 */
export function focus (elem) {
  if (!elem || typeof elem.focus !== 'function') {
    return
  }

  elem.focus()
}

let transformKey

function getTransformKey () {
  if (transformKey) {
    return transformKey
  }

  transformKey = '-ms-transform' in document.documentElement.style
    ? 'msTransform'
    : 'transform'
  return transformKey
}

/**
 * 获取变换矩阵
 *
 * @param {HTMLElement} el 目标元素
 * @return {string} matrix 信息
 */
export function getTransform (el) {
  return getComputedStyle(el)[getTransformKey()]
}

/**
 * 设置 transform
 *
 * @param {HTMLElement} el 目标元素
 * @param {string} value 变换值
 */
export function setTransform (el, value) {
  el.style[getTransformKey()] = value
}
