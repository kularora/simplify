'use strict';
const path = require('path')
if (typeof __non_webpack_require__ === 'undefined') global.__non_webpack_require__ = require

class StateExecution {
    
    constructor({ executionPath, verbosity }) {
        this.executionPath = executionPath || path.join(__dirname, "Functions")
        this.verbosity = verbosity
        this.STATE_FINISH = [ "DONE", "ERROR" ]
    }

    verbose(...args) {
        this.verbosity && console.log(...args)
    }

    isFinished(state) {
        return this.STATE_FINISH.indexOf(state) === -1 ? false : true
    }

    runNextExecution({ event, context }, stateObject, states) {
        const _thisFunction = this
        
        return new Promise((resolve, reject) => {
            const _modulePath = `${path.join(_thisFunction.executionPath, stateObject.Run)}`
            const _stateFunction = __non_webpack_require__(_modulePath).handler
            _thisFunction.verbose(`StateExecution:RUN_CONTEXT name = ${stateObject.Run} args =`, JSON.stringify(event.args))
            _stateFunction(event, context, function (err, data) {
                if (err && !_thisFunction.isFinished(stateObject.Other)) {
                    event.dataContext = data
                    event.errorContext = err
                    event.retryState = event.retryState || stateObject.Retry
                    if (event.retryState && --event.retryState > 0) {
                        _thisFunction.verbose(`StateExecution:RETRY_CONTEXT name = ${stateObject.Run} count = ${event.retryState}`)
                        _thisFunction.runNextExecution({ event, context }, stateObject, states).then(data => resolve(data)).catch(err => reject(err))
                    } else {
                        const nextState = states.find(state => state.Run === stateObject.Other)
                        if (!nextState) reject({ message: `The execution state is not available: ${stateObject.Other}` })
                        _thisFunction.runNextExecution({ event, context }, nextState, states).then(data => resolve(data)).catch(err => reject(err))
                    }
                } else if (err && _thisFunction.isFinished(stateObject.Other)) {
                    event.retryState = event.retryState || stateObject.Retry
                    if (event.retryState && --event.retryState > 0) {
                        _thisFunction.verbose(`StateExecution:RETRY_CONTEXT name = ${stateObject.Run} count = ${event.retryState}`)
                        _thisFunction.runNextExecution({ event, context }, stateObject, states).then(data => resolve(data)).catch(err => reject(err))
                    } else {
                        reject(err)
                    }
                } else if (!err && !_thisFunction.isFinished(stateObject.Next)) {
                    event.dataContext = data
                    event.errorContext = err
                    const nextState = states.find(state => state.Run === stateObject.Next)
                    if (!nextState) reject({ message: `The execution state is not available: ${stateObject.Next}` })
                    _thisFunction.runNextExecution({ event, context }, nextState, states).then(data => resolve(data)).catch(err => reject(err))
                } else if (!err && _thisFunction.isFinished(stateObject.Next)) {
                    resolve(data)
                }
            })
        })
    }

    execute(states, args, dataType, dataSchema) {
        return this.runNextExecution({ event: {
            ...args, dataType, dataSchema
        }, context: args.context }, states[0], states)
    }
}

module.exports = {
    StateExecution
}