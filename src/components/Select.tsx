/**
 * @file Select
 * @description
 * @author fex
 * @date 2017-11-07
 */

import uncontrollable = require('uncontrollable');
import React from 'react';
import 'react-datetime/css/react-datetime.css';
import Overlay from './Overlay';
import PopOver from './PopOver';
import Downshift, {ControllerStateAndHelpers} from 'downshift';
import cx from 'classnames';
import {closeIcon, Icon} from './icons';
import matchSorter from 'match-sorter';
import {noop} from '../utils/helper';
import find = require('lodash/find');
import isPlainObject = require('lodash/isPlainObject');
import union = require('lodash/union');
import {highlight} from '../renderers/Form/Options';
import {findDOMNode} from 'react-dom';
import {ClassNamesFn, themeable} from '../theme';
import Checkbox from './Checkbox';

export interface Option {
    label?: string;
    value?: any;
    disabled?: boolean;
    children?: Options;
    visible?: boolean;
    hidden?: boolean;
    [propName: string]: any;
}
export interface Options extends Array<Option> {}

export interface OptionProps {
    multi?: boolean;
    multiple?: boolean;
    valueField?: string;
    options: Options;
    joinValues?: boolean;
    extractValue?: boolean;
    delimiter?: string;
    clearable?: boolean;
    placeholder?: string;
    autoFill?: {[propName: string]: any};
}

export type OptionValue = string | number | null | undefined | Option;

export function value2array(value: OptionValue | Array<OptionValue>, props: Partial<OptionProps>): Array<Option> {
    if (props.multi || props.multiple) {
        if (typeof value === 'string') {
            value = value.split(props.delimiter || ',');
        }

        if (!Array.isArray(value)) {
            if (value === null || value === undefined) {
                return [];
            }

            value = [value];
        }

        return value.map((value: any) => expandValue(value, props)).filter((item: any) => item) as Array<Option>;
    } else if (Array.isArray(value)) {
        value = value[0];
    }

    let expandedValue = expandValue(value as OptionValue, props);
    return expandedValue ? [expandedValue] : [];
}

export function expandValue(value: OptionValue, props: Partial<OptionProps>): Option | null {
    const valueType = typeof value;

    if (valueType !== 'string' && valueType !== 'number' && valueType !== 'boolean') {
        return value as Option;
    }

    let {options} = props;

    if (!options) {
        return null;
    }

    return find(options, item => String(item[props.valueField || 'value']) === String(value)) as Option;
}

export function normalizeOptions(options: string | {[propName: string]: string} | Array<string> | Options): Options {
    if (typeof options === 'string') {
        return options.split(',').map(item => ({
            label: item,
            value: item
        }));
    } else if (Array.isArray(options as Array<string>) && typeof (options as Array<string>)[0] === 'string') {
        return (options as Array<string>).map(item => ({
            label: item,
            value: item
        }));
    } else if (Array.isArray(options as Options)) {
        return (options as Options).map(item => {
            let option = {
                ...item,
                value: item && item.value
            };

            if (typeof option.children !== 'undefined') {
                option.children = normalizeOptions(option.children);
            }

            return option;
        });
    } else if (isPlainObject(options)) {
        return Object.keys(options).map(key => ({
            label: (options as {[propName: string]: string})[key] as string,
            value: key
        }));
    }

    return [];
}

interface SelectProps {
    classPrefix: string;
    classnames: ClassNamesFn;
    className?: string;
    creatable: boolean;
    multiple: boolean;
    valueField: string;
    labelField: string;
    searchable?: boolean;
    options: Array<Option>;
    value: any;
    loadOptions?: Function;
    searchPromptText: string;
    loading?: boolean;
    loadingPlaceholder: string;
    spinnerClassName?: string;
    noResultsText: string;
    clearable: boolean;
    clearAllText: string;
    clearValueText: string;
    placeholder: string;
    inline: boolean;
    disabled: boolean;
    popOverContainer?: any;
    promptTextCreator: (label: string) => string;
    onChange: (value: void | string | Option | Array<Option>) => void;
    onNewOptionClick: (value: Option) => void;
    onFocus?: Function;
    onBlur?: Function;
    checkAll?: boolean;
    checkAllLabel?: string;
    defaultCheckAll?: boolean;
    simpleValue?: boolean;
}

interface SelectState {
    isOpen: boolean;
    isFocused: boolean;
    inputValue: string;
    highlightedIndex: number;
    selection: Array<Option>;
}

export class Select extends React.Component<SelectProps, SelectState> {
    static defaultProps = {
        multiple: false,
        clearable: true,
        creatable: false,
        searchPromptText: '输入内容进行检索',
        loadingPlaceholder: '加载中..',
        noResultsText: '没有结果',
        clearAllText: '移除所有',
        clearValueText: '移除',
        placeholder: '请选择',
        valueField: 'value',
        labelField: 'label',
        spinnerClassName: 'fa fa-spinner fa-spin fa-1x fa-fw',
        promptTextCreator: (label: string) => `新增：${label}`,
        onNewOptionClick: noop,
        inline: false,
        disabled: false,
        checkAll: false,
        checkAllLabel: '全选',
        defaultCheckAll: false
    };

    input: HTMLInputElement;
    target: HTMLElement;
    menu: React.RefObject<HTMLDivElement> = React.createRef();
    constructor(props: SelectProps) {
        super(props);

        this.open = this.open.bind(this);
        this.close = this.close.bind(this);
        this.toggle = this.toggle.bind(this);
        this.onBlur = this.onBlur.bind(this);
        this.onFocus = this.onFocus.bind(this);
        this.focus = this.focus.bind(this);
        this.inputRef = this.inputRef.bind(this);
        this.handleChange = this.handleChange.bind(this);
        this.handleInputChange = this.handleInputChange.bind(this);
        this.clearValue = this.clearValue.bind(this);
        this.handleStateChange = this.handleStateChange.bind(this);
        this.handleKeyPress = this.handleKeyPress.bind(this);
        this.getTarget = this.getTarget.bind(this);
        this.toggleCheckAll = this.toggleCheckAll.bind(this);

        this.state = {
            isOpen: false,
            isFocused: false,
            inputValue: '',
            highlightedIndex: -1,
            selection: value2array(props.value, props)
        };
    }

    componentDidMount() {
        const {loadOptions, options, multiple, checkAll, defaultCheckAll, onChange, simpleValue} = this.props;
        let {selection} = this.state;

        if (multiple && checkAll && defaultCheckAll && options.length) {
            selection = union(options, selection);
            this.setState(
                {
                    selection: selection
                },
                () => onChange(simpleValue ? selection.map(item => item.value) : selection)
            );
        }

        loadOptions && loadOptions('');
    }

    componentWillReceiveProps(nextProps: SelectProps) {
        const props = this.props;

        if (props.value !== nextProps.value || JSON.stringify(props.options) !== JSON.stringify(nextProps.options)) {
            this.setState({
                selection: value2array(nextProps.value, nextProps)
            });
        }
    }

    open() {
        this.props.disabled ||
            this.setState({
                isOpen: true
            });
    }

    close() {
        this.setState({
            isOpen: false
        });
    }

    toggle(e?: React.MouseEvent<HTMLDivElement>) {
        if (e && this.menu.current && this.menu.current.contains(e.target as HTMLElement)) {
            return;
        }

        this.props.disabled ||
            this.setState({
                isOpen: !this.state.isOpen
            });
    }

    onFocus(e: any) {
        this.props.disabled ||
            this.setState(
                {
                    isFocused: true
                },
                this.focus
            );

        this.props.onFocus && this.props.onFocus(e);
    }

    onBlur(e: any) {
        this.setState({
            isFocused: false,
            inputValue: ''
        });

        this.props.onBlur && this.props.onBlur(e);
    }

    focus() {
        this.input ? this.input.focus() : this.getTarget() && this.getTarget().focus();
    }

    blur() {
        this.input ? this.input.blur() : this.getTarget() && this.getTarget().blur();
    }

    getTarget() {
        if (!this.target) {
            this.target = findDOMNode(this) as HTMLElement;
        }
        return this.target as HTMLElement;
    }

    inputRef(ref: HTMLInputElement) {
        this.input = ref;
    }

    toggleCheckAll() {
        const {options, onChange, simpleValue} = this.props;
        let {selection} = this.state;
        const optionsValues = options.map(option => option.value);
        const selectionValues = selection.map(select => select.value);
        const checkedAll = optionsValues.every(option => selectionValues.indexOf(option) > -1);

        selection = checkedAll ? [] : options;
        onChange(simpleValue ? selection.map(item => item.value) : selection);
    }

    removeItem(index: number, e?: React.MouseEvent<HTMLElement>) {
        const {onChange, simpleValue} = this.props;
        let {selection: value} = this.state;

        e && e.stopPropagation();
        value = Array.isArray(value) ? value.concat() : [value];
        value.splice(index, 1);

        onChange(simpleValue ? value.map(item => item.value) : value);
    }

    handleInputChange(evt: React.ChangeEvent<HTMLInputElement>) {
        const {loadOptions} = this.props;

        this.setState(
            {
                inputValue: evt.currentTarget.value
            },
            () => loadOptions && loadOptions(this.state.inputValue)
        );
    }

    handleChange(selectItem: any) {
        const {onChange, multiple, onNewOptionClick, simpleValue} = this.props;
        let {selection} = this.state;

        if (selectItem.isNew) {
            delete selectItem.isNew;
            onNewOptionClick(selectItem);
        }

        if (multiple) {
            selection = selection.concat();
            const idx = selection.indexOf(selectItem);
            if (~idx) {
                selection.splice(idx, 1);
            } else {
                selection.push(selectItem);
            }
            onChange(simpleValue ? selection.map(item => item.value) : selection);
        } else {
            onChange(simpleValue ? selectItem.value : selectItem);
        }
    }

    handleStateChange(changes: any) {
        const {multiple, checkAll} = this.props;
        let update: any = {};
        const loadOptions = this.props.loadOptions;
        let doLoad = false;

        if (changes.isOpen !== void 0) {
            update.isOpen = changes.isOpen;
        }

        if (changes.highlightedIndex !== void 0) {
            update.highlightedIndex = changes.highlightedIndex;
        }

        switch (changes.type) {
            case Downshift.stateChangeTypes.keyDownEnter:
            case Downshift.stateChangeTypes.clickItem:
                update = {
                    ...update,
                    inputValue: '',
                    isOpen: multiple && checkAll ? true : false,
                    isFocused: multiple && checkAll ? true : false
                };
                doLoad = true;
                break;
            case Downshift.stateChangeTypes.changeInput:
                update.highlightedIndex = 0;
                break;
        }

        if (Object.keys(update).length) {
            this.setState(update, doLoad && loadOptions ? () => loadOptions('') : undefined);
        }
    }

    handleKeyPress(e: React.KeyboardEvent) {
        if (e.key === ' ') {
            this.toggle();
        }
    }

    clearValue(e: React.MouseEvent<any>) {
        const onChange = this.props.onChange;
        e.preventDefault();
        e.stopPropagation();
        onChange('');
    }

    renderValue({inputValue, isOpen}: ControllerStateAndHelpers<any>) {
        const {multiple, placeholder, classPrefix: ns, labelField, searchable, creatable} = this.props;

        const selection = this.state.selection;

        if (searchable && !creatable && inputValue && (multiple ? !selection.length : true)) {
            return null;
        }

        if (!selection.length) {
            return creatable && inputValue ? null : (
                <div key="placeholder" className={`${ns}Select-placeholder`}>
                    {placeholder}
                </div>
            );
        }

        return selection.map((item, index) =>
            multiple ? (
                <div className={`${ns}Select-value`} key={index}>
                    <span className={`${ns}Select-valueIcon`} onClick={this.removeItem.bind(this, index)}>
                        ×
                    </span>
                    <span className={`${ns}Select-valueLabel`}>{item[labelField || 'label']}</span>
                </div>
            ) : inputValue && isOpen ? null : (
                <div className={`${ns}Select-value`} key={index}>
                    {item.label}
                </div>
            )
        );
    }

    renderOuter({selectedItem, getItemProps, highlightedIndex, inputValue, isOpen}: ControllerStateAndHelpers<any>) {
        const {
            popOverContainer,
            options,
            valueField,
            labelField,
            noResultsText,
            loadOptions,
            creatable,
            promptTextCreator,
            multiple,
            classnames: cx,
            checkAll,
            checkAllLabel
        } = this.props;
        const {selection} = this.state;

        let checkedAll = false;
        let checkedPartial = false;
        let filtedOptions: Array<Option> =
            inputValue && isOpen && !loadOptions
                ? matchSorter(options, inputValue, {
                      keys: [labelField || 'label', valueField || 'value']
                  })
                : options.concat();

        if (multiple) {
            if (checkAll) {
                const optionsValues = options.map(option => option.value);
                const selectionValues = selection.map(select => select.value);
                checkedAll = optionsValues.every(option => selectionValues.indexOf(option) > -1);
                checkedPartial = optionsValues.some(option => selectionValues.indexOf(option) > -1);
            } else {
                filtedOptions = filtedOptions.filter((option: any) => !~selectedItem.indexOf(option));
            }
        }

        if (inputValue && creatable && !find(options, item => item[labelField || 'label'] == inputValue)) {
            filtedOptions.unshift({
                [labelField]: inputValue,
                [valueField]: inputValue,
                isNew: true
            });
        }

        const menu = (
            <div ref={this.menu} className={cx('Select-menu')}>
                {multiple && checkAll ? (
                    <div className={cx('Select-checkAll')}>
                        <Checkbox
                            checked={checkedPartial}
                            partial={checkedPartial && !checkedAll}
                            onChange={this.toggleCheckAll}
                        >
                            {checkAllLabel}
                        </Checkbox>
                    </div>
                ) : null}
                {filtedOptions.length ? (
                    filtedOptions.map((item, index) => {
                        const checked = checkAll ? selection.some((o: Option) => o.value == item.value) : false;

                        return (
                            <div
                                {...getItemProps({
                                    key: index,
                                    index,
                                    item,
                                    disabled: item.disabled
                                })}
                                className={cx(`Select-option`, {
                                    'is-disabled': item.disabled,
                                    'is-highlight': highlightedIndex === index,
                                    'is-active':
                                        selectedItem === item ||
                                        (Array.isArray(selectedItem) && ~selectedItem.indexOf(item))
                                })}
                            >
                                {checkAll ? (
                                    <Checkbox
                                        checked={checked}
                                        trueValue={item.value}
                                        onChange={() => this.handleChange(item)}
                                    >
                                        {item.isNew
                                            ? promptTextCreator(item.label as string)
                                            : item.disabled
                                            ? item[labelField]
                                            : highlight(item[labelField], inputValue as string, cx('Select-option-hl'))}
                                    </Checkbox>
                                ) : item.isNew ? (
                                    promptTextCreator(item.label as string)
                                ) : (
                                    <span>
                                        {item.disabled
                                            ? item.label
                                            : highlight(item[labelField], inputValue as string, cx('Select-option-hl'))}
                                        {item.tip}
                                    </span>
                                )}
                            </div>
                        );
                    })
                ) : (
                    <div className={cx('Select-option Select-option--placeholder')}>{noResultsText}</div>
                )}
            </div>
        );

        if (popOverContainer) {
            return (
                <Overlay container={popOverContainer} placement="left-bottom-left-top" target={this.getTarget} show>
                    <PopOver
                        className={cx('Select-popover')}
                        style={{width: this.target ? this.target.offsetWidth : 'auto'}}
                    >
                        {menu}
                    </PopOver>
                </Overlay>
            );
        } else {
            return <div className={cx('Select-menuOuter')}>{menu}</div>;
        }
    }

    render() {
        const {
            classnames: cx,
            multiple,
            searchable,
            inline,
            className,
            value,
            loading,
            spinnerClassName,
            clearable,
            labelField,
            disabled
        } = this.props;

        const selection = this.state.selection;
        const inputValue = this.state.inputValue;

        return (
            <Downshift
                selectedItem={selection}
                highlightedIndex={this.state.highlightedIndex}
                isOpen={this.state.isOpen}
                inputValue={inputValue}
                onChange={this.handleChange}
                onStateChange={this.handleStateChange}
                onOuterClick={this.close}
                itemToString={item => (item ? item[labelField] : '')}
            >
                {(options: ControllerStateAndHelpers<any>) => {
                    const {isOpen, getInputProps} = options;
                    return (
                        <div
                            tabIndex={searchable || disabled ? -1 : 0}
                            onKeyPress={this.handleKeyPress}
                            onClick={this.toggle}
                            onFocus={this.onFocus}
                            onBlur={this.onBlur}
                            className={cx(
                                `Select`,
                                {
                                    [`Select--multi`]: multiple,
                                    [`Select--inline`]: inline,
                                    [`Select--searchable`]: searchable,
                                    'is-opened': isOpen,
                                    'is-focused': this.state.isFocused,
                                    'is-disabled': disabled
                                },
                                className
                            )}
                        >
                            <div className={cx(`Select-valueWrap`)}>
                                {this.renderValue(options)}
                                {searchable ? (
                                    <input
                                        {...getInputProps({
                                            className: cx(`Select-input`),
                                            onFocus: this.onFocus,
                                            onBlur: this.onBlur,
                                            onKeyDown: event => {
                                                if (event.key === 'Backspace' && !inputValue) {
                                                    this.removeItem(value.length - 1);
                                                }
                                            },
                                            onChange: this.handleInputChange,
                                            ref: this.inputRef
                                        })}
                                    />
                                ) : null}
                            </div>
                            {clearable && !disabled && value && value.length ? (
                                <a onClick={this.clearValue} className={cx('Select-clear')}>
                                    <Icon icon="close" className="icon" />
                                </a>
                            ) : null}
                            {loading ? (
                                <span className={cx('Select-spinner')}>
                                    <i className={spinnerClassName} />
                                </span>
                            ) : null}

                            <span className={cx('Select-arrow')} />
                            {isOpen ? this.renderOuter(options) : null}
                        </div>
                    );
                }}
            </Downshift>
        );
    }
}

export default themeable(
    uncontrollable(Select, {
        value: 'onChange'
    })
);
