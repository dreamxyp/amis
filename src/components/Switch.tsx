/**
 * @file Switch
 * @description
 * @author fex
 */

import React from 'react';
import cx from 'classnames';
import {ClassNamesFn, themeable} from '../theme';
import {classPrefix, classnames} from '../themes/default';

const sizeMap = {
    md: 'i-switch-md',
    lg: 'i-switch-lg',
    middle: 'i-switch-md',
    large: 'i-switch-lg'
};

const levelMap = {
    info: 'bg-info',
    primary: 'bg-primary',
    danger: 'bg-danger'
};

interface SwitchProps {
    id?: string;
    size?: 'md' | 'lg' | 'middle' | 'large';
    level?: 'info' | 'primary' | 'danger';
    className?: string;
    classPrefix: string;
    classnames: ClassNamesFn;
    onChange?: (checked: boolean) => void;
    value?: any;
    inline?: boolean;
    trueValue?: any;
    falseValue?: any;
    disabled?: boolean;
    readOnly?: boolean;
    checked?: boolean;
}

export class Switch extends React.PureComponent<SwitchProps, any> {
    static defaultProps = {
        trueValue: true,
        falseValue: false
    };

    constructor(props: SwitchProps) {
        super(props);

        this.hanldeCheck = this.hanldeCheck.bind(this);
    }

    hanldeCheck(e: React.ChangeEvent<HTMLInputElement>) {
        const {trueValue, falseValue, onChange} = this.props;

        if (!onChange) {
            return;
        }

        onChange(e.currentTarget.checked ? trueValue : falseValue);
    }

    render() {
        let {
            size,
            level,
            className,
            classPrefix,
            onChange,
            value,
            inline,
            trueValue,
            falseValue,
            disabled,
            readOnly,
            checked,
            classnames: cx,
            ...rest
        } = this.props;

        className =
            (className ? className : '') +
            (size && sizeMap[size] ? ` ${sizeMap[size]}` : '') +
            (level && levelMap[level] ? ` ${levelMap[level]}` : '');

        return (
            <label className={cx(`Switch`, disabled ? 'is-disabled' : '', className)}>
                <input
                    type="checkbox"
                    checked={
                        typeof checked !== 'undefined'
                            ? checked
                            : typeof value === 'undefined'
                            ? false
                            : value == trueValue
                    }
                    onChange={this.hanldeCheck}
                    disabled={disabled}
                    readOnly={readOnly}
                    {...rest}
                />
                <i />
            </label>
        );
    }
}

export default themeable(Switch);
